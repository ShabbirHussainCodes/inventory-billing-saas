from rest_framework import serializers
from .models import Customer, Invoice, InvoiceItem, Estimate, EstimateItem, Expense
from inventory.models import Product


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'tax_number',
            'country',
            'is_active',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    # Explicit field declarations — bulletproof for nested writable serializers
    # Meta.read_only_fields alone can fail in some DRF versions
    product_name = serializers.CharField(read_only=True)
    subtotal     = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total        = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    profit       = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'product',
            'product_name',
            'quantity',
            'unit_price',
            'cost_price',
            'tax_rate',
            'discount_amount',
            'subtotal',
            'tax_amount',
            'total',
            'profit'
        ]
        read_only_fields = ['id']


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)

    class Meta:
        model = Invoice
        fields = [
            'customer',
            'invoice_date',
            'due_date',
            'status',   # Allow setting status on creation (draft/sent)
            'notes',
            'items'
        ]

    def validate(self, attrs):
        # Cross-tenant isolation check.
        # Invoice banane se pehle verify karo ki:
        # 1. Customer is tenant ka hai
        # 2. Har product is tenant ka hai
        # Vague errors intentional — attacker ko UUID existence confirm nahi karni
        tenant = self.context['tenant']

        # Customer ownership check
        customer = attrs.get('customer')
        if customer and customer.tenant != tenant:
            raise serializers.ValidationError({
                'customer': 'Invalid customer.'
            })

        # Product ownership + stock availability check — har item ke liye
        items = attrs.get('items', [])
        for i, item in enumerate(items):
            product = item.get('product')
            quantity = item.get('quantity', 0)

            # Ownership check
            if product and product.tenant != tenant:
                raise serializers.ValidationError({
                    'items': f'Invalid product in item {i + 1}.'
                })

            # Fix 5: Stock availability check — negative stock nahi hoga
            if product and product.stock_quantity < quantity:
                raise serializers.ValidationError({
                    'items': (
                        f'"{product.name}" mein sirf {product.stock_quantity} '
                        f'units available hain. Requested: {quantity}.'
                    )
                })

        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from .utils import generate_invoice_number

        # Items alag nikalo
        items_data = validated_data.pop('items')
        tenant = self.context['tenant']
        user = self.context['user']

        # transaction.atomic() — agar koi step fail ho to SAB rollback ho
        # Pehle bug yahi tha: StockMovement crash hota tha lekin Invoice
        # already create ho chuka hota tha (partial data, totals=0)
        with transaction.atomic():
            invoice = Invoice.objects.create(
                tenant=tenant,
                created_by=user,
                invoice_number=generate_invoice_number(tenant),
                currency=tenant.currency,
                tax_label=tenant.tax_label,
                **validated_data
            )

            subtotal = 0
            tax_amount = 0
            total_profit = 0

            for item_data in items_data:
                product = item_data.get('product')

                if product:
                    item_data['product_name'] = product.name
                    item_data['cost_price'] = product.cost_price
                    item_data['tax_rate'] = product.tax_rate

                    # Stock update karo
                    product.stock_quantity -= item_data['quantity']
                    product.save()

                    # StockMovement record — history + AI ke liye
                    # FIX: model field 'note' hai (singular), 'notes' nahi
                    from inventory.models import StockMovement
                    StockMovement.objects.create(
                        tenant=tenant,
                        product=product,
                        movement_type='out',
                        quantity=item_data['quantity'],
                        note='Invoice sale',
                        user=user,
                    )

                invoice_item = InvoiceItem.objects.create(
                    invoice=invoice,
                    **item_data
                )

                subtotal += invoice_item.subtotal
                tax_amount += invoice_item.tax_amount
                total_profit += invoice_item.profit

            # Invoice totals update karo
            invoice.subtotal = subtotal
            invoice.tax_amount = tax_amount
            invoice.total_amount = subtotal + tax_amount
            invoice.total_profit = total_profit

            # Agar invoice seedha 'paid' status ke saath ban rahi hai
            # (buildPayload() status directly set kar sakta hai — koi
            # separate PATCH zaroori nahi), paid_at yahin capture karo.
            if invoice.status == 'paid':
                from django.utils import timezone
                invoice.paid_at = timezone.now()

            invoice.save()

        return invoice


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source='customer.name',
        read_only=True
    )

    # Customer ke poore details — invoice detail view ke liye
    customer_email   = serializers.CharField(source='customer.email', read_only=True, default='')
    customer_phone   = serializers.CharField(source='customer.phone', read_only=True, default='')
    customer_address = serializers.CharField(source='customer.address', read_only=True, default='')
    customer_tax_number = serializers.CharField(source='customer.tax_number', read_only=True, default='')

    # Business (tenant) ke contact details — invoice header ke liye
    business_name    = serializers.CharField(source='tenant.name', read_only=True, default='')
    business_gst      = serializers.CharField(source='tenant.gst_number', read_only=True, default='')
    business_phone    = serializers.CharField(source='tenant.business_phone', read_only=True, default='')
    business_email    = serializers.CharField(source='tenant.business_email', read_only=True, default='')
    business_address  = serializers.CharField(source='tenant.business_address', read_only=True, default='')
    business_website  = serializers.CharField(source='tenant.business_website', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'customer',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_address',
            'customer_tax_number',
            'business_name',
            'business_gst',
            'business_phone',
            'business_email',
            'business_address',
            'business_website',
            'invoice_date',
            'due_date',
            'subtotal',
            'tax_amount',
            'total_amount',
            'total_profit',
            'currency',
            'tax_label',
            'status',
            'paid_at',
            'notes',
            'items',
            'created_at'
        ]
        read_only_fields = [
            'id',
            'invoice_number',
            'subtotal',
            'tax_amount',
            'total_amount',
            'total_profit',
            'currency',
            'tax_label',
            'paid_at',
            'created_at'
        ]

class InvoiceEditSerializer(serializers.ModelSerializer):
    """
    Edit existing DRAFT invoices only.
    Restores stock from old items, then applies new items —
    all wrapped in transaction.atomic() for data integrity.
    """
    items = InvoiceItemSerializer(many=True)

    class Meta:
        model = Invoice
        fields = ['customer', 'invoice_date', 'due_date', 'status', 'notes', 'items']

    def validate(self, attrs):
        tenant = self.context['tenant']
        invoice = self.instance

        # Business rule — sirf draft invoices edit ho sakte hain
        if invoice.status != 'draft':
            raise serializers.ValidationError({
                'non_field_errors': ['Only draft invoices can be edited.']
            })

        customer = attrs.get('customer')
        if customer and customer.tenant != tenant:
            raise serializers.ValidationError({'customer': 'Invalid customer.'})

        # Purane items ka quantity map — stock restore karne ke liye
        old_qty_map = {}
        for old_item in invoice.items.all():
            if old_item.product_id:
                old_qty_map[old_item.product_id] = (
                    old_qty_map.get(old_item.product_id, 0) + old_item.quantity
                )

        items = attrs.get('items', [])
        for i, item in enumerate(items):
            product = item.get('product')
            quantity = item.get('quantity', 0)

            if product and product.tenant != tenant:
                raise serializers.ValidationError({
                    'items': f'Invalid product in item {i + 1}.'
                })

            if product:
                # Effective available = current stock + jo isi invoice ne already allocate kiya tha
                effective_available = product.stock_quantity + old_qty_map.get(product.id, 0)
                if effective_available < quantity:
                    raise serializers.ValidationError({
                        'items': (
                            f'"{product.name}" has only {effective_available} '
                            f'available (including current allocation).'
                        )
                    })

        return attrs

    def update(self, instance, validated_data):
        from django.db import transaction
        from django.db.models import F
        from inventory.models import StockMovement

        tenant = self.context['tenant']
        user = self.context['user']
        items_data = validated_data.pop('items')

        # Edit sirf draft invoices pe allowed hai (validate() mein check
        # hota hai), par draft se seedha 'paid' bhi ban sakti hai isi save
        # mein (alag PATCH zaroori nahi) — is liye old status yahan capture
        # karo taaki paid_at sahi se set/clear ho.
        old_status = instance.status

        with transaction.atomic():
            # Step 1 — Purane items ka stock wapas add karo (F() = DB-level,
            # stale Python object issue se bachata hai), phir items delete karo
            old_items = list(instance.items.all())
            for old_item in old_items:
                if old_item.product_id:
                    Product.objects.filter(pk=old_item.product_id).update(
                        stock_quantity=F('stock_quantity') + old_item.quantity
                    )
                    StockMovement.objects.create(
                        tenant=tenant,
                        product_id=old_item.product_id,
                        movement_type='in',
                        quantity=old_item.quantity,
                        note='Invoice edited — stock restored',
                        user=user,
                    )
            instance.items.all().delete()

            # Step 2 — Invoice ke basic fields update karo
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            # Step 3 — Naye items banao, stock minus karo (F() expression se —
            # restoration ke baad ka FRESH value use hota hai, stale nahi)
            subtotal = 0
            tax_amount = 0
            total_profit = 0

            for item_data in items_data:
                product = item_data.get('product')

                if product:
                    # CRITICAL FIX: product object request shuru hone pe load
                    # hua tha — restoration ke baad uska stock stale ho chuka
                    # hai. Fresh value DB se dobara lo before deducting.
                    product.refresh_from_db()

                    item_data['product_name'] = product.name
                    item_data['cost_price'] = product.cost_price
                    item_data['tax_rate'] = product.tax_rate

                    Product.objects.filter(pk=product.id).update(
                        stock_quantity=F('stock_quantity') - item_data['quantity']
                    )

                    StockMovement.objects.create(
                        tenant=tenant,
                        product=product,
                        movement_type='out',
                        quantity=item_data['quantity'],
                        note='Invoice edited — updated sale',
                        user=user,
                    )

                invoice_item = InvoiceItem.objects.create(
                    invoice=instance,
                    **item_data
                )

                subtotal += invoice_item.subtotal
                tax_amount += invoice_item.tax_amount
                total_profit += invoice_item.profit

            instance.subtotal = subtotal
            instance.tax_amount = tax_amount
            instance.total_amount = subtotal + tax_amount
            instance.total_profit = total_profit

            if instance.status == 'paid' and old_status != 'paid':
                from django.utils import timezone
                instance.paid_at = timezone.now()
            elif instance.status != 'paid':
                instance.paid_at = None

            instance.save()

        return instance


class EstimateItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(read_only=True)
    subtotal     = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total        = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = EstimateItem
        fields = [
            'id',
            'product',
            'product_name',
            'quantity',
            'unit_price',
            'tax_rate',
            'subtotal',
            'tax_amount',
            'total',
        ]
        read_only_fields = ['id']


class EstimateSerializer(serializers.ModelSerializer):
    items = EstimateItemSerializer(many=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True, default='')
    customer_phone = serializers.CharField(source='customer.phone', read_only=True, default='')

    class Meta:
        model = Estimate
        fields = [
            'id', 'customer', 'customer_name', 'customer_email', 'customer_phone',
            'estimate_number', 'estimate_date', 'valid_until', 'status',
            'currency', 'tax_label',
            'subtotal', 'tax_amount', 'total_amount',
            'notes', 'items', 'converted_invoice',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'estimate_number', 'currency', 'tax_label',
            'subtotal', 'tax_amount', 'total_amount',
            'converted_invoice', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        # Tenant isolation check — Invoice ke jaisa hi pattern.
        # NOTE: yahan stock-availability check jaan-bujh kar NAHI hai —
        # ek estimate/quote dene ke liye stock abhi available hona
        # zaroori nahi (bas ek proposal hai), stock check sirf tab hoga
        # jab yeh actual Invoice mein convert hoga.
        tenant = self.context['tenant']

        customer = attrs.get('customer')
        if customer and customer.tenant != tenant:
            raise serializers.ValidationError({'customer': 'Invalid customer.'})

        items = attrs.get('items', [])
        if not items:
            raise serializers.ValidationError({'items': 'At least one item is required.'})

        for i, item in enumerate(items):
            product = item.get('product')
            if product and product.tenant != tenant:
                raise serializers.ValidationError({'items': f'Invalid product in item {i + 1}.'})

        return attrs

    def create(self, validated_data):
        from .utils import generate_estimate_number

        items_data = validated_data.pop('items')
        tenant = self.context['tenant']
        user = self.context['user']

        estimate = Estimate.objects.create(
            tenant=tenant,
            created_by=user,
            estimate_number=generate_estimate_number(tenant),
            currency=tenant.currency,
            tax_label=tenant.tax_label,
            **validated_data
        )

        subtotal = 0
        tax_amount = 0

        for item_data in items_data:
            product = item_data.get('product')
            if product:
                item_data['product_name'] = product.name
                item_data['tax_rate'] = product.tax_rate

            estimate_item = EstimateItem.objects.create(
                estimate=estimate,
                **item_data
            )
            subtotal += estimate_item.subtotal
            tax_amount += estimate_item.tax_amount

        estimate.subtotal = subtotal
        estimate.tax_amount = tax_amount
        estimate.total_amount = subtotal + tax_amount
        estimate.save()

        return estimate


class ExpenseSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_label', 'title', 'amount',
            'expense_date', 'payment_method', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']