from django.db import models
from django.conf import settings
import uuid


class SupportSession(models.Model):
    """
    Founder Support Mode session tracker.

    Jab founder kisi client ke workspace mein ghusta hai — yeh record banta hai.
    get_active_tenant() is model se resolve karta hai ki abhi kaun sa tenant active hai.

    is_active=True   → founder abhi us business mein hai
    is_active=False  → founder exit kar chuka hai
    """

    MODE_CHOICES = [
        ('view', 'View Only'),
        ('edit', 'Edit Mode'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    founder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='support_sessions'
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='support_sessions'
    )

    # View = sirf dekh sakta hai | Edit = changes kar sakta hai
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='view')
    is_active = models.BooleanField(default=True)

    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.founder.email} → {self.tenant.name} ({self.mode})"