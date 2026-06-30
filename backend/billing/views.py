from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Customer, Invoice
from .serializers import (
    CustomerSerializer,
    InvoiceSerializer,
    InvoiceCreateSerializer
)
from superadmin.utils import get_active_tenant, is_edit_mode


# ─── CUSTOMER VIEWS ───────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        customers = Customer.objects.filter(
            tenant=tenant,
            is_active=True
        )
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            customer = serializer.save(tenant=tenant)
            from superadmin.audit import log_action
            log_action(request, 'customer_created', tenant=tenant,
                       target_type='customer', target_name=customer.name)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def customer_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        customer = Customer.objects.get(pk=pk, tenant=tenant)
    except Customer.DoesNotExist:
        return Response(
            {'error': 'Customer not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = CustomerSerializer(customer)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            from superadmin.audit import log_action
            log_action(request, 'customer_updated', tenant=tenant,
                       target_type='customer', target_name=customer.name)
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    elif request.method == 'DELETE':
        customer.is_active = False
        customer.save()
        from superadmin.audit import log_action
        log_action(request, 'customer_deleted', tenant=tenant,
                   target_type='customer', target_name=customer.name)
        return Response(
            {'message': 'Customer deleted successfully.'},
            status=status.HTTP_200_OK
        )


# ─── INVOICE VIEWS ────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def invoice_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        invoices = Invoice.objects.filter(tenant=tenant)
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = InvoiceCreateSerializer(
            data=request.data,
            context={
                'tenant': tenant,
                'user': request.user
            }
        )
        if serializer.is_valid():
            invoice = serializer.save()
            return Response(
                InvoiceSerializer(invoice).data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def invoice_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        invoice = Invoice.objects.get(pk=pk, tenant=tenant)
    except Invoice.DoesNotExist:
        return Response(
            {'error': 'Invoice not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        # Sirf draft invoices delete ho sakte hain — sent/paid pe history
        # preserve karni hai (accounting integrity)
        if invoice.status != 'draft':
            return Response(
                {'error': 'Only draft invoices can be deleted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        from django.db.models import F
        from inventory.models import Product

        with transaction.atomic():
            # Stock wapas restore karo before delete
            for item in invoice.items.all():
                if item.product_id:
                    Product.objects.filter(pk=item.product_id).update(
                        stock_quantity=F('stock_quantity') + item.quantity
                    )
            invoice_number = invoice.invoice_number
            invoice.delete()

        from superadmin.audit import log_action
        log_action(request, 'invoice_status_changed', tenant=tenant,
                   target_type='invoice', target_name=invoice_number,
                   details={'action': 'deleted'})

        return Response({'message': 'Draft invoice deleted.'}, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        # Sirf draft invoices edit ho sakte hain — business rule
        if invoice.status != 'draft':
            return Response(
                {'error': 'Only draft invoices can be edited.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .serializers import InvoiceEditSerializer
        serializer = InvoiceEditSerializer(
            invoice,
            data=request.data,
            context={'tenant': tenant, 'user': request.user}
        )
        if serializer.is_valid():
            updated_invoice = serializer.save()

            from superadmin.audit import log_action
            log_action(request, 'invoice_status_changed', tenant=tenant,
                       target_type='invoice', target_name=updated_invoice.invoice_number,
                       details={'action': 'edited'})

            return Response(InvoiceSerializer(updated_invoice).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def invoice_update_status(request, pk):
    """Invoice ka status update karo — sirf status field"""
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        invoice = Invoice.objects.get(pk=pk, tenant=tenant)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found.'}, status=404)

    new_status = request.data.get('status')
    valid = ['draft', 'sent', 'paid', 'cancelled']
    if new_status not in valid:
        return Response({'error': f"Status must be one of: {', '.join(valid)}"}, status=400)

    old_status = invoice.status
    invoice.status = new_status
    invoice.save(update_fields=['status'])
    from superadmin.audit import log_action
    log_action(request, 'invoice_status_changed', tenant=tenant,
               target_type='invoice', target_name=invoice.invoice_number,
               details={'from': old_status, 'to': new_status})
    return Response({'id': str(invoice.id), 'status': invoice.status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def invoice_summary(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    from django.db.models import Sum, Count, Q
    from django.db.models.functions import Coalesce
    from decimal import Decimal

    # Single DB query — koi Python loop nahi
    agg = Invoice.objects.filter(tenant=tenant).aggregate(
        total_revenue=Coalesce(Sum('total_amount'), Decimal('0.00')),
        total_profit=Coalesce(Sum('total_profit'), Decimal('0.00')),
        total_invoices=Count('id'),
        paid_invoices=Count('id', filter=Q(status='paid')),
    )

    return Response({
        'total_invoices': agg['total_invoices'],
        'paid_invoices': agg['paid_invoices'],
        'total_revenue': agg['total_revenue'],
        'total_profit': agg['total_profit'],
        'currency': tenant.currency,
        'tax_label': tenant.tax_label,
    })