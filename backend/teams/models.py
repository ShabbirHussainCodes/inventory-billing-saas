from django.db import models
from django.conf import settings
import uuid


class Role(models.Model):
    """
    Ek Role staff ko kya karne ki ijazat hai, woh define karta hai.

    System roles (Owner, Manager, Sales Staff, Accountant, Viewer) —
    tenant=None, sabhi tenants ke liye common, delete nahi ho sakte.

    Custom roles — tenant se linked (Pro/Enterprise plans par), sirf
    us tenant ke andar dikhte hain, Owner unhe bana/edit/delete kar sakta hai.

    NOTE: Exact permission-per-system-role mapping abhi (Phase A ke shuru
    mein) decide nahi hui — RolePermission rows Phase A implementation ke
    saath hi seed honge, plan mein yeh explicitly flag kiya gaya hai.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # System role hai toh tenant=None (global, sab jagah available)
    # Custom role hai toh tenant set hoga (sirf us business ke liye)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='custom_roles'
    )

    name = models.CharField(max_length=100)

    # 5 default roles ke liye True — Owner, Manager, Sales Staff,
    # Accountant, Viewer. Yeh delete nahi ho sakte, edit bhi nahi
    # (permissions fixed hain, sirf custom roles editable hain).
    is_system_role = models.BooleanField(default=False)

    description = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['is_system_role']),
        ]
        constraints = [
            # System role names unique globally (tenant IS NULL)
            models.UniqueConstraint(
                fields=['name'],
                condition=models.Q(tenant__isnull=True),
                name='unique_system_role_name'
            ),
            # Custom role names unique per tenant
            models.UniqueConstraint(
                fields=['tenant', 'name'],
                condition=models.Q(tenant__isnull=False),
                name='unique_custom_role_name_per_tenant'
            ),
        ]

    def __str__(self):
        scope = 'System' if self.is_system_role else (self.tenant.name if self.tenant else 'Custom')
        return f"{self.name} ({scope})"


class Permission(models.Model):
    """
    Fixed catalog of available permissions — codebase ke actual modules
    ke hisaab se (billing, inventory, customers, reports, team, etc.)

    Yeh seed data hai — migration ke through populate hoga, UI se
    add/remove nahi hota. RolePermission is catalog ko roles se jodta hai.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # e.g. 'invoice.create', 'invoice.delete', 'customer.view', 'team.manage'
    codename = models.CharField(max_length=100, unique=True)

    # UI grouping ke liye — e.g. 'Billing', 'Inventory', 'Reports', 'Team'
    category = models.CharField(max_length=50)

    label = models.CharField(max_length=150)          # human readable, e.g. "Create Invoice"
    description = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['category', 'codename']
        indexes = [
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.codename


class RolePermission(models.Model):
    """Role <-> Permission through table."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='role_permissions')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['role', 'permission'], name='unique_role_permission')
        ]
        indexes = [
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.role.name} -> {self.permission.codename}"


class Membership(models.Model):
    """
    Core table — kaun kis business (tenant) ka member hai, kis Role ke saath.

    Yeh CustomUser.tenant + CustomUser.role (jo abhi legacy/deprecated ho
    rahe hain) ki jagah leta hai. get_active_tenant() ka normal-user path
    ab isi table se resolve hota hai.

    Ek user ki multiple Memberships ho sakti hain (multiple businesses
    ka staff/owner ho sakta hai) — is model se hi multi-tenant staff
    possible hota hai.

    Invite flow: Owner invite karta hai -> Membership(user=None,
    status='invited', invite_email=...) banta hai -> staff link click
    karke apna account link/create karta hai -> status 'active' hota hai.
    """

    STATUS_CHOICES = [
        ('invited', 'Invited'),      # Email bheja gaya, staff ne accept nahi kiya abhi
        ('active', 'Active'),        # Staff ne accept kar liya, normal access hai
        ('suspended', 'Suspended'),  # Owner ne temporarily access rok diya
        ('removed', 'Removed'),      # Staff ko team se hata diya gaya (soft — record rehta hai)
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Invite accept hone tak null rahega
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='memberships'
    )

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='memberships'
    )

    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,   # Role delete se pehle members move karne padenge
        related_name='memberships'
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='invited')

    # Invite ke waqt ka email — user account create/link hone ke baad bhi
    # reference ke liye rakha jaata hai
    invite_email = models.EmailField()
    invite_token = models.CharField(max_length=100, blank=True, default='', db_index=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='memberships_invited'
    )

    joined_at = models.DateTimeField(null=True, blank=True)   # jab status 'active' hua
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['invite_token']),
        ]
        constraints = [
            # Ek user ki ek tenant mein sirf ek Membership row ho sakti hai
            # (NULL user ke liye yeh constraint apply nahi hota — Postgres
            # multiple NULLs ko unique nahi maanta, so pending invites
            # (user=None) is se restrict nahi hote)
            models.UniqueConstraint(fields=['user', 'tenant'], name='unique_user_tenant_membership')
        ]

    def __str__(self):
        who = self.user.email if self.user else self.invite_email
        return f"{who} @ {self.tenant.name} ({self.role.name}, {self.status})"

    def save(self, *args, **kwargs):
        # Hard safety guard — Founder (super_admin) ko KABHI Membership row
        # nahi milni chahiye. Yeh Django-level CheckConstraint se enforce
        # nahi ho sakta (cross-table condition — Membership.user.role,
        # Postgres CHECK constraints sirf same-table columns pe kaam karte
        # hain), isliye yeh application-level guard hai jo har .save() pe
        # (admin panel se, shell se, kisi bhi future invite-accept code se)
        # chalta hai — DB-level raw constraint nahi hai.
        if self.user_id:
            user = self.user   # FK access — agar cache mein nahi hai toh 1 query
            if getattr(user, 'role', None) == 'super_admin':
                raise ValueError(
                    "Membership row cannot be created/saved for a super_admin "
                    "(Founder) user. Founder access must stay separate via "
                    "SupportSession — not via Role/Membership."
                )
        super().save(*args, **kwargs)


class ActivityLog(models.Model):
    """
    Team activity log — staff ke actions (invoice/price change/delete,
    invite/suspend/remove, role change) ka record. Tenant-scoped.

    NOTE: Yeh superadmin.AuditLog se jaanbujh kar alag rakha gaya hai
    (dono model designs discuss hue the — AuditLog ka is_support_action
    flag literally isi tarah ke reuse ke liye comment kiya hua tha, lekin
    is session mein decide hua ki "Team Activity" ek separate concern hai
    aur apna dedicated model rakhega, superadmin app founder-only rahega).
    """

    ACTION_CHOICES = [
        # Team management events
        ('member_invited',     'Member Invited'),
        ('member_joined',      'Member Joined'),
        ('member_suspended',   'Member Suspended'),
        ('member_reactivated', 'Member Reactivated'),
        ('member_removed',     'Member Removed'),
        ('role_changed',       'Role Changed'),
        ('role_created',       'Role Created'),
        ('role_updated',       'Role Updated'),
        ('role_deleted',       'Role Deleted'),
        # View-as
        ('view_as_started',    'View As Started'),
        ('view_as_ended',      'View As Ended'),
        ('view_as_mode_switched', 'View As Mode Switched'),
        # Business data events (mirrors superadmin.AuditLog's product/customer/invoice set)
        ('product_created',    'Product Created'),
        ('product_updated',    'Product Updated'),
        ('product_deleted',    'Product Deleted'),
        ('customer_created',   'Customer Created'),
        ('customer_updated',   'Customer Updated'),
        ('customer_deleted',   'Customer Deleted'),
        ('invoice_status_changed', 'Invoice Status Changed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='team_activity_logs'
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='team_activity_logs'
    )

    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=50, blank=True)
    target_name = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)

    # Agar yeh action kisi ne "View as Member" mode mein perform kiya
    viewed_as_membership = models.ForeignKey(
        Membership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='actions_performed_as'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['actor', '-created_at']),
        ]

    def __str__(self):
        return f"{self.actor.email} | {self.action} | {self.tenant.name}"


class LoginEvent(models.Model):
    """
    Har login attempt ka record — security/audit ke liye (kis IP se,
    kis device se, kaunse tenant mein login hua).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='login_events'
    )
    # Multi-tenant staff ke liye — is login mein kaunsa business select hua
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='login_events'
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default='')
    success = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.created_at}"
