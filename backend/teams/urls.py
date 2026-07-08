from django.urls import path
from . import views

urlpatterns = [
    path('invite/', views.invite_member, name='team-invite'),
    path('invite/<str:token>/', views.invite_detail, name='team-invite-detail'),
    path('invite/<str:token>/accept/', views.accept_invite, name='team-invite-accept'),

    path('roles/', views.role_list, name='team-role-list'),

    path('members/', views.member_list, name='team-member-list'),
    path('members/<uuid:membership_id>/suspend/', views.suspend_member, name='team-member-suspend'),
    path('members/<uuid:membership_id>/reactivate/', views.reactivate_member, name='team-member-reactivate'),
    path('members/<uuid:membership_id>/', views.remove_member, name='team-member-remove'),
    path('members/<uuid:membership_id>/role/', views.change_member_role, name='team-member-role'),
]
