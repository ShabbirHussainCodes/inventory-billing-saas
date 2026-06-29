from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import uuid


class CustomUserManager(BaseUserManager):

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email address is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'super_admin')
        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractBaseUser, PermissionsMixin):

    # --- Roles ---
    ROLE_CHOICES = [
        ('super_admin', 'Super Admin'),
        ('business_owner', 'Business Owner'),
        ('staff', 'Staff'),
    ]

    # --- Unique ID ---
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # --- Basic Info ---
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True, null=True)

    # --- Role ---
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='business_owner'
    )

    # --- Tenant Link ---
    # Kaun se business se belong karta hai
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='users'
    )

    # --- Permissions ---
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- Login Field ---
    # Username ki jagah email se login hoga
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.email} ({self.role})"

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'role']),
            models.Index(fields=['is_active']),
            models.Index(fields=['-created_at']),
        ]