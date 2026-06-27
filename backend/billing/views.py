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
            serializer.save(tenant=tenant)
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
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    elif request.method == 'DELETE':
        customer.is_active = False
        customer.save()
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


@api_view(['GET'])
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

    serializer = InvoiceSerializer(invoice)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def invoice_summary(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    invoices = Invoice.objects.filter(tenant=tenant)

    total_revenue = sum(
        inv.total_amount for inv in invoices
    )
    total_profit = sum(
        inv.total_profit for inv in invoices
    )
    total_invoices = invoices.count()
    paid_invoices = invoices.filter(status='paid').count()

    return Response({
        'total_invoices': total_invoices,
        'paid_invoices': paid_invoices,
        'total_revenue': total_revenue,
        'total_profit': total_profit,
        'currency': tenant.currency,
        'tax_label': tenant.tax_label,
    })