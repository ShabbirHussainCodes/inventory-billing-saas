from django.urls import path
from . import views

urlpatterns = [
    # Categories
    path('categories/', views.category_list, name='category-list'),

    # Suppliers
    path('suppliers/', views.supplier_list, name='supplier-list'),

    # Products
    path('products/', views.product_list, name='product-list'),
    path('products/<uuid:pk>/', views.product_detail, name='product-detail'),

    # Low stock alert
    path('low-stock/', views.low_stock_products, name='low-stock'),

    # Stock movement
    path('stock-movement/', views.add_stock_movement, name='stock-movement'),
]