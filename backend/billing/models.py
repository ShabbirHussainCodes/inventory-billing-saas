from django.db import models
from django.conf import settings
import uuid


class Customer(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='customers'
    )

    # --- Basic Info ---
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    # --- Business Info ---
    # GSTIN for Indian B2B customers
    # VAT number for UAE/UK customers
    tax_number = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )
    country = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"

    class Meta:
        ordering = ['name']


class Invoice(models.Model):

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='invoices'
    )

    # --- Invoice Number ---
    # Auto generate hoga — INV-2026-001
    invoice_number = models.CharField(
        max_length=50
    )

    # --- Dates ---
    invoice_date = models.DateField()
    due_date = models.DateField(
        blank=True,
        null=True
    )

    # --- Amounts ---
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total_profit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    # --- Global Ready ---
    # Har tenant ki currency alag ho sakti hai
    currency = models.CharField(
        max_length=10,
        default='INR'
    )
    tax_label = models.CharField(
        max_length=50,
        default='GST'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.invoice_number} — {self.customer.name}"

    class Meta:
        ordering = ['-created_at']
        # Per-tenant unique — do alag businesses ke INV-2026-001 clash nahi karenge
        unique_together = [('tenant', 'invoice_number')]
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', '-created_at']),
        ]


class InvoiceItem(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True,
        related_name='invoice_items'
    )

    # --- Item Details ---
    product_name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    # --- Calculated Fields ---
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )
    profit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    def save(self, *args, **kwargs):
        # Automatically calculate karo jab bhi save ho
        self.subtotal = self.unit_price * self.quantity
        self.tax_amount = self.subtotal * (self.tax_rate / 100)
        self.total = self.subtotal + self.tax_amount
        self.profit = (
            self.unit_price - self.cost_price
        ) * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    class Meta:
        ordering = ['id']

class BusinessSuggestion(models.Model):
    """
    Business Brief — v1 of the Decision Engine.
    Rules-based suggestions (restock, dead stock, overdue collection)
    delivered to the tenant via Telegram + Dashboard.

    Status tracking (sent/acted/dismissed) is the foundation for future
    "Business Memory" — learning which suggestions this specific tenant
    acts on vs ignores. That pattern-learning needs months of data to
    become meaningful; this model just starts collecting it from day one.
    """
    CATEGORY_CHOICES = [
        ('restock', 'Restock Needed'),
        ('dead_stock', 'Dead Stock'),
        ('overdue', 'Overdue Collection'),
    ]
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('acted', 'Acted On'),
        ('dismissed', 'Dismissed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='suggestions'
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True)

    # Optional links — jis product/invoice/customer se yeh suggestion related hai
    related_product = models.ForeignKey(
        'inventory.Product', on_delete=models.SET_NULL, null=True, blank=True
    )
    related_invoice = models.ForeignKey(
        'billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True
    )

    priority_score = models.IntegerField(default=0)  # zyada = zyada urgent
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')

    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_category_display()} — {self.title}"


class Estimate(models.Model):
    """
    Quote/Estimate — pre-invoice stage. Draft → Sent → Accepted → Converted,
    with Rejected as a side-branch (not part of the main happy path).

    Key difference from Invoice: creating/sending an Estimate does NOT
    touch stock and does NOT count toward the plan's monthly invoice
    limit — it's not a sale yet, just a proposal.
    """
    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('sent',      'Sent'),
        ('accepted',  'Accepted'),
        ('rejected',  'Rejected'),
        ('converted', 'Converted'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='estimates'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='estimates'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='estimates'
    )

    estimate_number = models.CharField(max_length=50)
    estimate_date = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # Tenant se snapshot liya jaata hai creation ke time — Invoice jaisa pattern
    currency = models.CharField(max_length=10, default='INR')
    tax_label = models.CharField(max_length=50, default='GST')

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True, null=True)

    # Agar convert ho jaaye toh yahan link store hoga
    converted_invoice = models.ForeignKey(
        Invoice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_estimate'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'estimate_number'],
                name='unique_estimate_number_per_tenant'
            )
        ]

    def __str__(self):
        return f"{self.estimate_number} — {self.customer.name}"


class EstimateItem(models.Model):
    """
    Line item on an Estimate — mirrors InvoiceItem's structure but
    WITHOUT cost_price/profit fields. A quote isn't a completed sale,
    so tracking profit on it doesn't make sense yet — that only
    becomes meaningful once it's converted to an actual Invoice.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estimate = models.ForeignKey(
        Estimate,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        'inventory.Product',
        on_delete=models.SET_NULL,
        null=True,
        related_name='estimate_items'
    )
    product_name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        # InvoiceItem jaisa hi calculation pattern — cost_price/profit
        # nahi hai isliye woh lines yahan nahi hain
        self.subtotal = self.unit_price * self.quantity
        self.tax_amount = self.subtotal * (self.tax_rate / 100)
        self.total = self.subtotal + self.tax_amount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"

    class Meta:
        ordering = ['id']


class HealthScoreSnapshot(models.Model):
    """
    Saved every time the health score is calculated — lets us show a
    trend ("+5 vs last month") by comparing against an older snapshot,
    instead of only ever showing a single point-in-time number.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='health_snapshots')
    total_score = models.IntegerField()
    cash_score = models.IntegerField()
    sales_score = models.IntegerField()
    inventory_score = models.IntegerField()
    operations_score = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Expense(models.Model):
    """
    General business expense tracking — rent, salary, utilities, etc.
    Deliberately SEPARATE from Purchase Orders (which are inventory/stock
    related) and does NOT affect Invoice-based profit calculations
    anywhere else in the app — this is a standalone tracking tool, not
    a step toward double-entry accounting (consistent with BillingMars's
    "Decision Engine, not accounting software" positioning).
    """
    CATEGORY_CHOICES = [
        ('rent',       'Rent'),
        ('salary',     'Salary'),
        ('utilities',  'Utilities'),
        ('marketing',  'Marketing'),
        ('supplies',   'Supplies'),
        ('transport',  'Transport'),
        ('other',      'Other'),
    ]
    PAYMENT_METHOD_CHOICES = [
        ('cash',  'Cash'),
        ('bank',  'Bank Transfer'),
        ('card',  'Card'),
        ('upi',   'UPI'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='expenses')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='expenses'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date', '-created_at']

    def __str__(self):
        return f"{self.title} — ₹{self.amount}"