"""
Demand Forecasting — Plan A (current infra constraints)

Design decisions, stated explicitly (not hidden in code comments only):

1. NO external forecasting library (no statsforecast/prophet/darts).
   Croston's method is implemented directly from its published formula
   (verified against multiple independent sources describing the same
   equations). This avoids depending on a specific package's exact
   current API, which wasn't independently verified against current
   docs — safer than guessing at import paths/class names.

2. Pandas IS used (added after reconsideration) — for the time-series
   handling itself (Series with a proper date index, reindexing to
   fill missing dates with 0). This is genuinely standard practice for
   this kind of work and, importantly, means Plan B (when SARIMA/
   Prophet/Croston-via-library get added later, once paid infra +
   more data exist) can reuse this same data-prep layer instead of
   rewriting it — those libraries expect pandas Series/DataFrames as
   input.

3. NO Celery/scheduling. This runs on-demand via a manual "Generate
   Forecast" button, matching the Business Brief / Close Day pattern
   already established. Automatic/scheduled forecasting is a Plan B
   item (needs paid Render tier + Celery).

4. Thresholds below (MIN_DATA_POINTS, DENSE_THRESHOLD, alpha) are
   reasonable starting defaults, NOT scientifically validated optimal
   values — flagged the same way every other threshold in this
   project has been (dead stock days, health score weights, etc.).
"""

import pandas as pd
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum
from .models import InvoiceItem

# Design-choice constants — see module docstring point 4.
MIN_DATA_POINTS = 14        # kam se kam itne din ka observation window chahiye
DENSE_THRESHOLD = 0.5       # is se zyada % din mein sale ho toh "dense"
CROSTON_ALPHA = 0.1         # smoothing factor — common starting value in
                            # published examples, not a proven optimum


def get_daily_sales_series(tenant, product, lookback_days=90):
    """
    Product ka daily sales history ek pandas Series ki tarah nikalta hai —
    DatetimeIndex ke saath, missing dates 0 se fill hoti hain (yeh zaroori
    hai intermittent detection ke liye — "koi sale nahi hui" ek real
    signal hai, missing row nahi hona chahiye).

    Sirf completed sales (sent/paid invoices) count hoti hain, draft/
    cancelled nahi.

    Returns: (series: pd.Series, days_observed: int)
    """
    today = timezone.now().date()
    start_date = today - timezone.timedelta(days=lookback_days)

    rows = InvoiceItem.objects.filter(
        invoice__tenant=tenant,
        invoice__status__in=['sent', 'paid'],
        product=product,
        invoice__invoice_date__gte=start_date,
        invoice__invoice_date__lte=today,
    ).values('invoice__invoice_date').annotate(total=Sum('quantity'))

    if rows:
        df = pd.DataFrame(list(rows))
        df['invoice__invoice_date'] = pd.to_datetime(df['invoice__invoice_date'])
        series = df.set_index('invoice__invoice_date')['total']
    else:
        series = pd.Series(dtype='float64')

    # Poori date range banao aur missing dates ko 0 se fill karo —
    # yeh standard pandas time-series pattern hai (verified: same
    # approach jo published intermittent-demand examples use karte hain)
    full_range = pd.date_range(start=start_date, end=today, freq='D')
    series = series.reindex(full_range, fill_value=0)

    return series, len(full_range)


def croston_forecast(series, alpha=CROSTON_ALPHA):
    """
    Croston's method — hand-implemented from the standard published
    formula (verified against multiple independent descriptions of
    the same equations). Accepts a pandas Series (or any iterable of
    numbers) — iterating over a Series yields its values directly.

    Splits the series into two smoothed components:
    - z: smoothed size of non-zero demand events
    - p: smoothed interval (in days) between non-zero demand events

    Forecast (units/day) = z / p

    Returns: forecast_rate (float) or None if no non-zero demand exists.
    """
    z = None
    p = None
    q = 0  # counter of days since last non-zero demand

    for qty in series:
        q += 1
        if qty > 0:
            if z is None:
                # First non-zero observation — initialize directly,
                # no smoothing possible yet
                z = qty
                p = q
            else:
                z = alpha * qty + (1 - alpha) * z
                p = alpha * q + (1 - alpha) * p
            q = 0

    if z is None or not p:
        return None  # kabhi koi sale hi nahi hui is window mein

    return z / p


def moving_average_forecast(series, window=14):
    """
    Simple, transparent moving average — used for 'dense' pattern
    products where a plain average is a fair representation. Uses
    pandas' built-in tail+mean (standard idiom) since 'dense' products
    don't have the long zero-stretches that made Croston necessary.
    """
    if len(series) == 0:
        return None
    return series.tail(window).mean()


def classify_and_forecast(tenant, product):
    """
    Main entry point — classifies the product's sales pattern and
    returns the appropriate forecast, or an honest "insufficient data"
    result if there isn't enough history to say anything meaningful.

    Returns dict: {pattern_type, forecast_daily_rate, data_points_used, note}
    """
    series, days_observed = get_daily_sales_series(tenant, product)

    non_zero_days = int((series > 0).sum())

    if non_zero_days < 3:
        # Fewer than 3 actual sale-days in the whole window — genuinely
        # not enough signal to forecast honestly, regardless of method.
        return {
            'pattern_type': 'insufficient_data',
            'forecast_daily_rate': None,
            'data_points_used': days_observed,
            'note': f'Only {non_zero_days} sale-day(s) recorded in the last {days_observed} days — not enough history to forecast.',
        }

    sale_ratio = non_zero_days / days_observed

    if sale_ratio >= DENSE_THRESHOLD:
        rate = moving_average_forecast(series)
        pattern = 'dense'
        note = f'Regular seller — sold on {non_zero_days} of last {days_observed} days. Forecast uses a 14-day moving average.'
    else:
        rate = croston_forecast(series)
        pattern = 'intermittent'
        note = f'Occasional seller — sold on only {non_zero_days} of last {days_observed} days. Forecast uses Croston\'s method (designed for sparse demand).'

    return {
        'pattern_type': pattern,
        'forecast_daily_rate': round(Decimal(str(rate)), 4) if rate is not None else None,
        'data_points_used': days_observed,
        'note': note,
    }