from django.urls import path
from . import views

urlpatterns = [
    path('invite/', views.invite_member, name='team-invite'),
    path('invite/<str:token>/', views.invite_detail, name='team-invite-detail'),
    path('invite/<str:token>/accept/', views.accept_invite, name='team-invite-accept'),
]
