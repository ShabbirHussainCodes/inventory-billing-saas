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