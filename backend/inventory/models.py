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