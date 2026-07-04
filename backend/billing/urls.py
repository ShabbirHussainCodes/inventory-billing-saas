from django.urls import path
from . import views

urlpatterns = [
    # Customers
    path('customers/', views.customer_list, name='customer-list'),
    path('customers/<uuid:pk>/', views.customer_detail, name='customer-detail'),

    # Invoices
    path('invoices/', views.invoice_list, name='invoice-list'),
    path('invoices/<uuid:pk>/', views.invoice_detail, name='invoice-detail'),

    # Dashboard Summary
    path('summary/', views.invoice_summary, name='invoice-summary'),
    path('invoices/<uuid:pk>/status/', views.invoice_update_status, name='invoice-status'),
    path('close-day/', views.close_day, name='close-day'),
    path('cashflow/', views.cashflow_summary, name='cashflow-summary'),
    path('business-brief/', views.generate_business_brief, name='generate-business-brief'),
    path('suggestions/<uuid:suggestion_id>/status/', views.update_suggestion_status, name='update-suggestion-status'),
]