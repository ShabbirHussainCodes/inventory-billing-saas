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
]