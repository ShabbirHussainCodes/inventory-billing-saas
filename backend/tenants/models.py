from django.db import models
import uuid

class Tenant(models.Model):

    # --- Unique ID ---
    # Har tenant ka ek unique ID hoga
    # UUID use karte hain — 1, 2, 3 se zyada secure hai
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # --- Basic Info ---
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=100, unique=True)

    # --- Global Ready Fields ---
    # Yeh fields abhi use nahi honge
    # But database mein pehle se rahenge
    country = models.CharField(max_length=100, default='India')
    currency = models.CharField(max_length=10, default='INR')
    tax_label = models.CharField(max_length=50, default='GST')
    timezone = models.CharField(max_length=100, default='Asia/Kolkata')

    # --- Access Control ---
    # Tu Super Admin se kisi ko bhi access de sakta hai
    ACCESS_TYPES = [
        ('paid', 'Paid Subscription'),
        ('admin_grant', 'Granted by Admin'),
        ('free_tier', 'Free Tier'),
    ]
    access_type = models.CharField(
        max_length=20,
        choices=ACCESS_TYPES,
        default='free_tier'
    )
    is_active = models.BooleanField(default=True)

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['access_type']),
            models.Index(fields=['-created_at']),
        ]