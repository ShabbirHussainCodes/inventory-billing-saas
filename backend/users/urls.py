from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('login/select-business/', views.select_business_view, name='login-select-business'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),

    # JWT Token Refresh
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
]