from django.urls import path
from . import views

urlpatterns = [
    # Categories
    path('categories/', views.category_list, name='category-list'),
    path('categories/<uuid:pk>/', views.category_detail, name='category-detail'),

    # Suppliers
    path('suppliers/', views.supplier_list, name='supplier-list'),
    path('suppliers/<uuid:pk>/', views.supplier_detail, name='supplier-detail'),

    # Products
    path('products/', views.product_list, name='product-list'),
    path('products/<uuid:pk>/', views.product_detail, name='product-detail'),

    # Low stock alert
    path('low-stock/', views.low_stock_products, name='low-stock'),

    # Stock movement
    path('stock-movement/', views.add_stock_movement, name='stock-movement'),
    path('stock-movements/', views.stock_movement_list, name='stock-movement-list'),

    # Purchase Orders
    path('purchase-orders/', views.purchase_order_list, name='purchase-order-list'),
    path('purchase-orders/<uuid:pk>/', views.purchase_order_detail, name='purchase-order-detail'),
    path('purchase-orders/<uuid:pk>/status/', views.purchase_order_update_status, name='purchase-order-status'),
    path('purchase-orders/freight-summary/', views.freight_summary, name='freight-summary'),
]