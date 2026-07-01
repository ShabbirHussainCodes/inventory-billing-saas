from django.urls import path
from . import views

urlpatterns = [
    path('settings/', views.business_settings, name='business-settings'),
    path('telegram/webhook/', views.telegram_webhook, name='telegram-webhook'),
]