from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Admin panel
    path('admin/', admin.site.urls),

    # Authentication APIs
    path('api/auth/', include('users.urls')),

    # Inventory APIs
    path('api/inventory/', include('inventory.urls')),
]