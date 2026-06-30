from django.urls import path
from . import views

urlpatterns = [
    path('settings/', views.business_settings, name='business-settings'),
]