from django.db import models
from django.conf import settings
import uuid


class Category(models.Model):
    # Har category ek tenant ki hogi
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='categories'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Categories'


class Supplier(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='suppliers'
    )
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.tenant.name})"

    class Meta:
        ordering = ['name']


class Product(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='products'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products'
    )

    # --- Basic Info ---
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, null=True)

    # --- Pricing ---
    # Cost price = kitne mein kharida
    # Selling price = kitne mein becha
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)

    # --- Stock ---
    stock_quantity = models.IntegerField(default=0)
    reorder_point = models.IntegerField(default=10)

    # --- Shipping / Logistics ---
    # Cubic meters per unit — optional, used for calculating total shipment
    # volume on Purchase Orders. Only relevant for businesses ordering in
    # bulk/containers from suppliers.
    volume_cbm = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )

    # --- Tax ---
    # Global ready — GST/VAT/Sales Tax sab handle karega
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00
    )
    hsn_code = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    # --- Status ---
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.tenant.name}"

    @property
    def profit_margin(self):
        # Profit margin calculate karo — AI baad mein yahi use karega
        if self.selling_price and self.cost_price and self.selling_price > 0:
            profit = self.selling_price - self.cost_price
            margin = (profit / self.selling_price) * 100
            return round(margin, 2)
        return 0

    @property
    def is_low_stock(self):
        # Low stock alert
        return self.stock_quantity <= self.reorder_point

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['tenant', 'stock_quantity']),
        ]
        constraints = [
            # SKU sirf ACTIVE products mein unique ho — deleted (inactive)
            # products ka SKU dobara use kiya ja sakta hai
            models.UniqueConstraint(
                fields=['tenant', 'sku'],
                condition=models.Q(is_active=True),
                name='unique_active_sku_per_tenant',
            )
        ]


class StockMovement(models.Model):
    # Har ek stock change ka record
    # Yahi data baad mein AI ko train karega

    MOVEMENT_TYPES = [
        ('in', 'Stock In'),       # Maal aaya
        ('out', 'Stock Out'),     # Maal gaya (sale)
        ('adjustment', 'Adjustment'),  # Manual correction
        ('return', 'Return'),     # Customer ne wapas kiya
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='stock_movements'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='movements'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_movements'
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPES
    )
    quantity = models.IntegerField()
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product.name} — {self.movement_type} — {self.quantity}"

    class Meta:
        ordering = ['-created_at']

class PurchaseOrder(models.Model):
    """
    Order placed with a supplier — tracks what's "on the way" but not
    yet received. When marked Received, stock is added automatically.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('ordered', 'Ordered'),
        ('received', 'Received'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='purchase_orders'
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_orders'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    order_date = models.DateField(null=True, blank=True)
    expected_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)

    # --- Freight / Shipping charges ---
    # Simplified version of the industry-standard "Landed Cost" concept
    # (seen in Odoo, etc.) — total shipping cost for the order, distributed
    # across items for REPORTING purposes only. This does NOT modify
    # Product.cost_price — that's a deliberate scope decision, since
    # BillingMars doesn't have double-entry/batch-level costing, and
    # silently changing cost_price via freight would be a bigger, separate
    # decision than what was asked for here.
    FREIGHT_SPLIT_CHOICES = [
        ('equal',       'Equally across items'),
        ('by_quantity', 'By quantity'),
        ('by_value',    'By item value (cost × qty)'),
        ('by_volume',   'By volume (CBM)'),
    ]
    freight_charge = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    freight_split_method = models.CharField(
        max_length=20, choices=FREIGHT_SPLIT_CHOICES, default='by_value'
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        supplier_name = self.supplier.name if self.supplier else 'Unknown supplier'
        return f"PO — {supplier_name} — {self.status}"

    def get_freight_allocation(self):
        """
        Returns {item_id: allocated_freight_amount (Decimal)} based on
        freight_split_method. Uses Decimal throughout — never float —
        since this is money and rounding errors are not acceptable.

        Honest limitation: for 'by_volume', items whose product has no
        volume_cbm set are excluded from the total and get ₹0 allocated.
        If only some items have CBM set, this will skew freight onto
        those items rather than distributing fairly across all of them.
        This is a known trade-off — CBM-based splitting only makes sense
        when all items in the order have volume set.
        """
        from decimal import Decimal
        items = list(self.items.select_related('product').all())
        if not items or not self.freight_charge:
            return {}

        allocation = {}

        if self.freight_split_method == 'equal':
            share = self.freight_charge / Decimal(len(items))
            for item in items:
                allocation[item.id] = share

        elif self.freight_split_method == 'by_quantity':
            total_qty = sum(item.quantity_ordered for item in items)
            if total_qty == 0:
                return {}
            for item in items:
                allocation[item.id] = (
                    Decimal(item.quantity_ordered) / Decimal(total_qty)
                ) * self.freight_charge

        elif self.freight_split_method == 'by_value':
            total_value = sum(item.unit_cost * item.quantity_ordered for item in items)
            if total_value == 0:
                return {}
            for item in items:
                item_value = item.unit_cost * item.quantity_ordered
                allocation[item.id] = (item_value / total_value) * self.freight_charge

        elif self.freight_split_method == 'by_volume':
            # Override takes priority — supplier-told CBM for THIS order
            # line, falling back to the product's own default volume.
            def get_item_volume(item):
                if item.volume_cbm_override is not None:
                    return item.volume_cbm_override
                if item.product and item.product.volume_cbm:
                    return item.product.volume_cbm
                return Decimal('0')

            total_volume = sum(get_item_volume(item) * item.quantity_ordered for item in items)
            if total_volume == 0:
                return {}
            for item in items:
                item_volume = get_item_volume(item) * item.quantity_ordered
                allocation[item.id] = (item_volume / total_volume) * self.freight_charge

        return allocation

    class Meta:
        ordering = ['-created_at']


class PurchaseOrderItem(models.Model):
    """
    Line item on a Purchase Order. quantity_received is tracked
    separately from quantity_ordered from day one — even though v1's
    UI only supports marking an order fully received (not partial),
    having this field now means partial receiving can be added later
    as a UI change only, without a future migration.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True
    )
    product_name = models.CharField(max_length=255)  # snapshot, same pattern as InvoiceItem

    quantity_ordered = models.IntegerField()
    quantity_received = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)

    # --- Per-order volume override ---
    # Verified via Odoo community research: standard Odoo's Volume field
    # is product-level only (one fixed value per SKU). Real-world need
    # (confirmed by an actual Odoo forum thread) is that the SAME product
    # can arrive in different box/carton sizes depending on supplier or
    # shipment — so a fixed per-product volume isn't always accurate.
    # This field lets the actual CBM for THIS specific order/line be typed
    # in (as told by the supplier), overriding the product's default.
    # If left blank, the product's own volume_cbm is used as a fallback.
    volume_cbm_override = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )

    def __str__(self):
        return f"{self.product_name} × {self.quantity_ordered}"