from django.db import models
from django.conf import settings
import uuid


class SupportSession(models.Model):
    """
    Founder Support Mode session tracker.
    Jab founder kisi client ke workspace mein ghusta hai — yeh record banta hai.
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
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='view')
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.founder.email} → {self.tenant.name} ({self.mode})"


class AuditLog(models.Model):
    """
    Production-grade audit log for Founder Support Mode.

    Har founder action yahan record hota hai — kab, kis business mein,
    kya kiya, kya change hua. Yeh accountability aur transparency ke liye hai.

    is_support_action=True  → founder ne client ke workspace mein kiya
    is_support_action=False → future mein normal user actions ke liye
    """

    ACTION_CHOICES = [
        # Session events
        ('workspace_entered',       'Workspace Entered'),
        ('workspace_exited',        'Workspace Exited'),
        ('mode_switched',           'Mode Switched'),
        # View As Member events (Phase B.5) — Founder viewing-as a staff
        # member while already inside a SupportSession. Mirrors the same
        # three actions teams.ActivityLog already has for the Owner side.
        ('view_as_started',         'View As Started'),
        ('view_as_ended',           'View As Ended'),
        ('view_as_mode_switched',   'View As Mode Switched'),
        # Team management events (Phase B.6 Stage B) — Founder performing
        # routine team actions with Owner-equivalent operational parity.
        # Mirrors teams.ActivityLog's action set for the same events.
        ('member_invited',         'Member Invited'),
        ('member_suspended',       'Member Suspended'),
        ('member_reactivated',     'Member Reactivated'),
        ('member_removed',         'Member Removed'),
        ('role_changed',           'Role Changed'),
        # Primary Owner transfer (Phase B.6 Stage C) — Founder-assisted
        # handoff of Primary Owner status between two active Owners.
        ('primary_owner_transferred', 'Primary Owner Transferred'),
        # Platform Case events (Phase B.6 Stage E) — exceptional/
        # adversarial situations, tracked separately from routine
        # Stage C actions. See superadmin.models.PlatformCase.
        ('platform_case_opened',    'Platform Case Opened'),
        ('platform_case_closed',    'Platform Case Closed'),
        ('password_reset',          'Password Reset'),
        # Product events
        ('product_created',         'Product Created'),
        ('product_updated',         'Product Updated'),
        ('product_deleted',         'Product Deleted'),
        # Customer events
        ('customer_created',        'Customer Created'),
        ('customer_updated',        'Customer Updated'),
        ('customer_deleted',        'Customer Deleted'),
        # Invoice events
        ('invoice_status_changed',  'Invoice Status Changed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Who performed the action
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )

    # Which business was affected
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )

    # What happened
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)

    # What was affected — human readable
    target_type = models.CharField(max_length=50, blank=True)   # 'product', 'customer', 'invoice', 'session'
    target_name = models.CharField(max_length=255, blank=True)  # e.g. 'Samsung TV 43'

    # Extra context — flexible JSON
    # Examples:
    #   mode_switched        → {'from': 'view', 'to': 'edit'}
    #   invoice_status       → {'from': 'draft', 'to': 'paid', 'invoice_number': 'INV-2026-001'}
    #   workspace_entered    → {'mode': 'view'}
    details = models.JSONField(default=dict, blank=True)

    # Was this a founder support action?
    is_support_action = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            # Fast filtering by tenant (most common query)
            models.Index(fields=['tenant', '-created_at']),
            # Fast filtering by actor
            models.Index(fields=['actor', '-created_at']),
            # Fast filtering by support actions only
            models.Index(fields=['is_support_action', '-created_at']),
        ]

    def __str__(self):
        return f"{self.actor.email} | {self.action} | {self.tenant.name}"


class TenantDeletionLog(models.Model):
    """
    Permanent record of deleted tenants — survives even after the
    tenant itself is gone (no FK to Tenant, sirf snapshot fields).

    Yeh isliye alag model hai, AuditLog nahi — kyunki AuditLog.tenant
    CASCADE hai, matlab agar hum "tenant deleted" wala record AuditLog
    mein save karte, woh khud bhi tenant delete hote hi mit jaata
    (apna hi proof gayab). Yahan koi FK nahi hai, isliye yeh permanent hai.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Snapshot — tenant delete hone ke baad bhi yeh info bachi rahegi
    tenant_id_snapshot = models.UUIDField()   # FK nahi, sirf reference ke liye
    tenant_name = models.CharField(max_length=255)
    owner_email = models.CharField(max_length=255, blank=True)

    # Kitna data delete hua — transparency ke liye
    products_count = models.IntegerField(default=0)
    customers_count = models.IntegerField(default=0)
    invoices_count = models.IntegerField(default=0)
    users_count = models.IntegerField(default=0)

    # Kisne delete kiya — user delete ho jaaye toh bhi email yaad rahe
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='tenant_deletions'
    )
    deleted_by_email_snapshot = models.CharField(max_length=255, blank=True)

    reason = models.CharField(max_length=255, blank=True)  # optional note
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-deleted_at']

    def __str__(self):
        return f"{self.tenant_name} deleted on {self.deleted_at.date()}"


class PlatformCase(models.Model):
    """
    Phase B.6 Stage E — Platform Case framework.

    Yeh Stage C se DELIBERATELY alag hai. Stage C ("routine Founder-
    assisted actions") ke liye bas reason + identity_verification_notes
    kaafi hai — customer khud call karke pooch raha hai, Founder turant
    kar deta hai, dono logs mein likh jaata hai, kaam khatam.

    Platform Case genuinely EXCEPTIONAL / adversarial situations ke
    liye hai — fraud, legal request, ownership dispute (dono Owners
    apna-apna daava kar rahe hain), account recovery, emergency
    intervention. Yahan ek proper case record chahiye: kab khula, kis
    wajah se, kisne khola, kisne execute kiya, kya decide hua, kab band
    hua — chahe underlying DB action (jaise Primary Owner transfer)
    technically Stage C ke jaisa hi ho.

    Design decisions (locked after discussion):
    - Lifecycle: sirf open → closed (koi "investigating" state nahi,
      v1 ke liye). Case khula reh sakta hai jab tak decision nahi hota —
      investigation off-platform hoti hai, case sirf record rakhta hai.
    - Business ko is case ka koi trace kabhi nahi dikhta — pura
      PlatformCase model AuditLog jaisa hi Founder-only hai. Jo actual
      action execute hota hai (jaise primary owner transfer), woh
      business ki apni ActivityLog mein NORMAL entry ki tarah dikhta
      hai — bina kisi "yeh ek case tha" reference ke.
    - created_by aur executed_by jaan-boojh kar alag fields hain, chahe
      abhi dono hamesha same Founder hon — future-proofing for a
      scenario where ek support rep case khole aur koi senior/Founder
      use execute kare.
    - Two-step flow: case open() turant record ban jaata hai (reason +
      notes save ho jaate hain) — actual system action sirf close()
      ke waqt hota hai, jab resolution decide ho chuka ho.
    """

    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]

    # Extensible by design — sirf pehle 2 case types abhi implement
    # hain (forced_ownership_transfer, account_recovery), lekin naye
    # case types add karna sirf ek naya choice + close() mein ek naya
    # branch hai, koi schema change nahi.
    CASE_TYPE_CHOICES = [
        ('forced_ownership_transfer', 'Forced Ownership Transfer'),
        ('account_recovery', 'Account Recovery'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    case_type = models.CharField(max_length=50, choices=CASE_TYPE_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')

    tenant = models.ForeignKey(
        'tenants.Tenant', on_delete=models.CASCADE, related_name='platform_cases'
    )

    # Generic target references — most case types will need one or the
    # other (or both). Both optional since not every future case type
    # will need both.
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_cases_as_target'
    )
    target_membership = models.ForeignKey(
        'teams.Membership', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_cases_as_target'
    )

    # Opened at — mandatory accountability fields, same pattern as
    # Stage C's _founder_ownership_fields, just persisted on a proper
    # case record instead of only inside a log entry's details JSON.
    reason = models.TextField()
    identity_verification_notes = models.TextField()
    details = models.JSONField(default=dict, blank=True)  # open-time extra structured data

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='platform_cases_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Closed at — filled only when the case is resolved and the actual
    # system action has been executed.
    resolution_notes = models.TextField(blank=True)
    resolution_details = models.JSONField(default=dict, blank=True)  # close-time extra structured data
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_cases_executed'
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f"{self.get_case_type_display()} | {self.tenant.name} | {self.status}"