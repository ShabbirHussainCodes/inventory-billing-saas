# 🗺️ BILLINGMARS — TEAM MANAGEMENT SYSTEM (MASTER PLAN — UPDATED)

> Yeh original plan ka updated version hai. Jo bhi ✅ COMPLETED marked hai, woh
> real code mein ban chuka hai aur sandbox-verified hai. Jo 🔄 IN PROGRESS /
> ⏳ PENDING hai, woh design-locked hai but implement nahi hua abhi.

> ## 🏁 STATUS (latest update): TEAM MANAGEMENT MODULE — POORA COMPLETE
> Phase A se Phase C tak (Custom Roles + Device Sessions/Logout-Everywhere
> sameet) sab kuch ban chuka hai, sandbox mein verify hua, aur commit ho
> chuka hai. Sirf 🔮 Phase F (approval workflows, departments/branches)
> baaki hai — jo shuru se hi "future, abhi scope mein nahi" mark tha.
> Neeche har section apna individual status rakhta hai, is banner ke
> baad detail padhte raho.

═══════════════════════════════════════
CORE ARCHITECTURE — EK LINE MEIN
═══════════════════════════════════════
Tenant-scoped RBAC — Membership table se staff ko business se
jodenge, Role se unki permissions decide hongi. Har business ka
EXACTLY EK Primary Owner hoga jo business-level ownership-authority
rakhta hai. Founder Platform Administrator hai — normal support
mein Business Owner jaisi full operational parity rakhta hai, par
sensitive ownership-actions extra accountability ke saath, aur
sach mein exceptional situations (fraud/dispute/recovery/legal)
ek alag Platform Case workflow se guzarti hain.

═══════════════════════════════════════
FOUNDATION — KYA BADLA, KYA SAME RAHA
═══════════════════════════════════════
✅ SAME RAHA:
   - is_super_admin() function
   - SupportSession / Founder ka access mechanism
   - get_active_tenant() ka Founder wala path (SupportSession se resolve)

✅ BADAL CHUKA (COMPLETED):
   - User.role → 'super_admin' / 'business_owner' / 'staff'
   - get_active_tenant() ka normal-user wala path → Membership se
     resolve hota hai (multi-tenant staff ke liye JWT tenant_id
     claim sirf disambiguation ke liye, kabhi permission cache nahi)

✅ NAYA BAN CHUKA (COMPLETED):
   - Membership, Role, Permission, RolePermission models
   - ActivityLog (staff-side) + AuditLog (Founder-side, superadmin app)
   - LoginEvent, PendingLoginToken
   - ViewAsSession (Phase B.5)
   - Membership.is_primary_owner + unique-active-primary-per-tenant
     constraint (Phase B.6 Stage 1)

Verified fact (unchanged): get_active_tenant() sirf handful files
mein use hota hai — migration risk contained raha, jaisa plan tha.

═══════════════════════════════════════
SYSTEM ROLES — 5 DEFAULT + UNLIMITED CUSTOM (Phase A — ✅ DONE)
═══════════════════════════════════════
1. Owner        — sab kuch, delete nahi ho sakta, kam se kam
                   ek active Owner hamesha zaroori
2. Manager       — zyadatar cheezein, Purchase Order delete bhi
3. Sales Staff   — invoice/estimate/customer (basic fields only)
4. Accountant    — reports/profit/payment related
5. Viewer        — sirf dekh sakta hai

Exact permission-per-role mapping FINALIZED — 44 permissions across
6 categories, migrations 0002/0005/0006/0007 mein seed hui. Poora
matrix ARCHITECTURE.md mein reference table ke roop mein maujood hai.

CUSTOM ROLES (Phase C — ✅ DONE):
   Free        → Nahi milega (create block hota hai, 403)
   Pro/Enterprise/Admin Grant → Milega
   Schema pehle se hi ready tha (Role.tenant nullable, Permission.category
   grouping ke liye) — koi migration nahi lagi, sirf endpoints + UI bane.
   Gate 'role.manage_custom' permission pe hai — yeh 'team.manage' se
   JAANBUJH KAR alag permission hai (Phase A se hi seed thi, comment mein
   "Deliberately excluded" likha tha Manager ke liye) — Manager team
   manage kar sakta hai par naye roles nahi bana sakta, sirf Owner (aur
   Owner-role-parity se Founder) bana sakta hai.
   Naye endpoints: GET /team/permissions/ (catalog), POST /team/roles/create/,
   PATCH /team/roles/<id>/, DELETE /team/roles/<id>/delete/. Plan gate
   sirf CREATE pe hai — downgrade hone pe existing custom roles edit/delete
   ho sakte hain, sirf naye nahi ban sakte (retroactive breakage avoid).
   Frontend: TeamPage.jsx mein "Manage Roles" button, RolesManager.jsx
   component — category-wise grouped checkbox permission editor.

═══════════════════════════════════════
STAFF AUTHENTICATION — ALAG ID/PASSWORD (Phase A/B — ✅ DONE)
═══════════════════════════════════════
- Har staff ka apna alag email + password
- Invite flow: Owner email + role daale → invite_token generate hota
  hai → Owner khud link share karta hai (Render Free tier pe email
  infra nahi hai — yeh explicit decision thi, scope se bahar)
- Staff link click kare → account create/link ho jaata hai →
  Membership status 'invited' → 'active'
- Owner/Founder KABHI staff ka password directly set/dekh nahi
  sakte

ACCOUNT CREATION FLOW — jaisa plan tha, waisa hi bana:
1. Owner "Invite Staff" → email + role_id → POST /team/invite/
2. Membership { user: null, tenant, role, status: 'invited',
   invite_token } banta hai
3. Owner link share karta hai (email/WhatsApp/kuch bhi)
4. Staff link kholta hai → GET /team/invite/:token/ (account_exists
   flag batata hai) → POST .../accept/ (naya account ya existing
   account link, dono handle hote hain)
5. Membership 'invited' → 'active', joined_at set hota hai

MULTI-TENANT LOGIN — jaisa plan tha:
- Same login page, koi alag staff-login page nahi
- 1 active Membership → seedha login
- 2+ active Memberships → PendingLoginToken (2-min, single-use) →
  business-selection screen → /login/select-business/

═══════════════════════════════════════
"VIEW AS MEMBER" (Phase B.5 — ✅ DONE)
═══════════════════════════════════════
Use case: Owner (ya Founder, jab already SupportSession ke andar
ho) staff ka EXACT view/access dekh sakta hai, password touch kiye
bina.

Jaisa plan tha, waisa bana + extra safety:
- ViewAsSession model — initiator (Owner ya Founder), tenant,
  target_membership, target_role_at_start (snapshot), mode
  (view/edit), is_active, end_reason
- has_permission() ka pehla check hi View-As session hai — Founder
  ka normal "GET hamesha allowed" rule bhi override hota hai jab
  view-as active ho, taaki EXACTLY target member jaisa access mile
- Mode hamesha 'view' se start hota hai — Edit Simulation explicit
  alag call se on hoti hai

SAFETY RULES — jaisa plan tha, waisa bana:
1. UI banner: "Viewing As: [Name] ([Role])" — Layout.jsx mein,
   Founder ke SupportSession banner jaisa hi look
2. ActivityLog/AuditLog dono mein record — REAL actor kabhi
   overwrite nahi hota, viewed_as_membership ALAG field mein
3. AUTO-TERMINATION (plan mein nahi tha, baad mein add hua) — target
   role change / target suspended-removed / business suspended /
   Founder ka SupportSession khatam / initiator logout — sab
   fresh-DB-check se turant detect hota hai, koi cron/background job
   nahi chahiye

═══════════════════════════════════════
PERMISSION CHECKING — TURANT EFFECT GUARANTEE (✅ DONE, sab jagah)
═══════════════════════════════════════
- Permission KABHI JWT token mein "baked in" nahi hoti
- Har request pe FRESH database se check hoti hai — has_permission(),
  get_active_tenant(), aur ab ViewAsSession ki validity bhi sab
  fresh-query hain
- Role/permission/primary-owner/view-as — sab change turant agli
  request se lagu, logout-login ki zaroorat nahi

═══════════════════════════════════════
ACTIVITY TRACKING (Phase B — ✅ DONE, dual-actor bhi)
═══════════════════════════════════════
- Har action (invoice, price change, delete, invite/suspend/remove/
  role-change/primary-transfer) → ActivityLog record
- Team Activity page — get_active_tenant() se automatically scoped
- View-As active ho toh: real actor + viewed_as_membership dono
  record hote hain, actor KABHI overwrite nahi hota
- Founder-side same pattern AuditLog.details JSON mein ('viewed_as' key)

═══════════════════════════════════════
PRIMARY OWNER (Phase B.6 Stage 1 — ✅ DONE)
═══════════════════════════════════════
Plan mein yeh nahi tha — Phase B complete hone ke baad, multi-Owner
businesses mein "koi bhi Owner kisi bhi doosre Owner ko remove kar
sakta hai" wala governance gap discover hua, isliye add hua.

- Har tenant ka EXACTLY EK active Primary Owner — DB partial unique
  constraint se "at most one" enforce, registration + backfill +
  atomic handoff se "never zero" guarantee
- Naye signup ka founding Owner automatically Primary
- Existing tenants ka backfill — jo Owner sabse pehle bana, woh Primary
- Voluntary handoff — sirf current Primary Owner kar sakta hai,
  target active Owner hona chahiye, atomic flip (kabhi 2 primary
  ek saath nahi), ActivityLog mein record
- Baaki Owners ke liye day-to-day permissions IDENTICAL rehti hain —
  Primary sirf owner-management authority ke liye alag hai

✅ RESOLVED (Stage D — neeche dekho): non-Primary Owner ab kisi
   doosre Owner ko suspend/reactivate/remove/demote nahi kar sakta —
   sirf Primary Owner kar sakta hai. Stage D mein close hua.

═══════════════════════════════════════
FOUNDER = PLATFORM ADMINISTRATOR (Phase B.6 Stage A-E — NAYA, discussion se aaya)
═══════════════════════════════════════
Plan mein Founder sirf "support mode + view as" tak simplified tha.
Business-strategy discussion ke baad philosophy clear hui:

  1. Founder Platform Administrator hai, koi "aur ek business user" nahi
  2. Founder ko routine support ke liye Business Owner jaisi FULL
     operational parity chahiye (team management, invites, role
     changes, staff management, settings, invoices, inventory,
     customers) — kyunki BillingMars jaanbujh kar founder-led
     support platform hai
  3. Routine Founder-assisted actions fast rahenge, par hamesha
     properly audit-logged. Sensitive ownership-actions (Manage
     Owners, Make Primary Owner) normal support ke andar bhi
     MANDATORY reason + identity-verification-notes maangenge
  4. Sach mein exceptional situations (fraud, legal request,
     ownership dispute, account recovery, emergency intervention)
     ek ALAG "Platform Case" workflow se guzarengi — apni lifecycle
     aur audit trail ke saath
  5. Platform Case ek GENERIC framework hoga (case type, status
     lifecycle, reason, verification notes, created_by/executed_by)
     — sirf ownership-transfer tak limited nahi, taaki future case
     types (forced removal, fraud freeze, legal hold) bina rearchitect
     kiye fit ho sakein
  6. Founder platform ka highest authority rehta hai, par sabse
     sensitive actions hamesha complete, transparent audit trail
     chhodenge

STAGES (is philosophy ko implement karne ke liye):

  ✅ Stage A — Founder read-only Team visibility
     Business Workspace mein naya "Team" tab — roster (Primary Owner
     badge sahit), roles/permissions, pending invitations, activity
     feed. Koi backend permission change nahi lagi — Founder ka
     "GET hamesha allowed during support" rule already isse cover
     karta tha. Koi action button nahi — pure read-only.

  ✅ Stage B — Founder operational parity, routine actions — DONE
     has_permission() ka Founder-in-Edit-Mode path harden hua — pehle
     blanket True tha kisi bhi codename ke liye jab Edit Mode ho; ab
     tenant ke actual Owner role ke permission-set ke against fresh
     check karta hai (View-As jaisa hi pattern, bas Owner role fixed
     target hai). Founder UI (invite/role-change/suspend/remove)
     Team tab mein wire hua, Edit Mode-gated.

  ✅ Stage C — Founder parity, sensitive ownership actions — DONE
     remove/suspend/reactivate/change-role (jab target Owner ho) aur
     Make Primary Owner — Founder-in-Edit-Mode ab allow karta hai, par
     MANDATORY reason + identity-verification-notes fields ke saath
     (_founder_ownership_fields helper, teams/views.py). Yeh alag se
     distinctly logged hote hain — details JSON mein
     'founder_ownership_action: True' + reason + notes — dono
     ActivityLog (business-visible) aur AuditLog (Founder-only) mein.

  ✅ Stage D — Owner-vs-Owner guards (Primary Owner authority) — DONE
     Sirf Primary Owner kisi doosre Owner ko suspend/reactivate/remove/
     demote kar sakta hai (_require_primary_owner helper). Reactivate
     bhi guard mein shamil kiya gaya — warna non-primary Owner Primary
     ke suspend ko turant undo kar sakta tha, poora guard bekaar ho
     jaata. Promotion-TO-Owner jaanbujh kar UNguarded rakha — usse
     kisi existing Owner ki standing kam nahi hoti, sirf ek peer add
     hota hai. Non-primary Owners baaki sab kuch waise hi kar sakte
     hain jaise pehle karte the.

  ✅ Stage E — Platform Case generic framework — DONE
     Model (superadmin.PlatformCase): case_type, status (open/closed —
     v1 ke liye single-step lifecycle, "under_review" jaisa multi-step
     add nahi kiya abhi), reason, identity_verification_notes, details
     (JSON), created_by, executed_by (jaanbujh kar ALAG fields rakhe
     future dual-control ke liye), timestamps. Founder Panel mein naya
     "Platform Cases" section (PlatformCasesPage.jsx). Pehle 2 case
     types: forced_ownership_transfer + account_recovery (jo pehle se
     mojood — par zero-audit — reset_user_password endpoint ko wrap
     karta hai). Two-step flow: case open() sirf record banata hai,
     actual action sirf close() pe execute hota hai.

     Open points resolve ho chuke (final decisions):
     - Severity/urgency flag — NAHI add kiya, v1 simple rakha
     - Business ko trace dikhna chahiye? — NAHI, fully invisible.
       Underlying action (jaise primary transfer) business ki apni
       ActivityLog mein NORMAL entry ki tarah dikhta hai, koi case
       reference nahi. Sirf Founder-side AuditLog mein platform_case_id
       reference hota hai.
     - created_by/executed_by — ALAG rakhe, jaisa decide hua tha.

═══════════════════════════════════════
BUILD ORDER — ACTUAL STATUS
═══════════════════════════════════════
✅ PHASE A → Core Foundation — DONE
✅ PHASE B → Activity + Team Management UI — DONE
✅ PHASE B.5 → "View As Member" — DONE
✅ PHASE B.6 Stage 1 → Primary Owner core — DONE
✅ PHASE B.6 Stage A → Founder read-only Team visibility — DONE
✅ PHASE B.6 Stage B → Founder parity, routine actions — DONE
✅ PHASE B.6 Stage C → Founder parity, sensitive ownership actions — DONE
✅ PHASE B.6 Stage D → Owner-vs-Owner guards — DONE
✅ PHASE B.6 Stage E → Platform Case framework — DONE
✅ PHASE C (part 1) → Custom Roles + Permission Editor — DONE
   (teams/roles.py, RolesManager.jsx — koi migration nahi lagi,
   schema Phase A se hi ready tha)
✅ PHASE C (part 2) → Device Sessions / Logout-Everywhere — DONE
   Simplified v1: precise per-device revoke NAHI banaya (SimpleJWT ka
   ROTATE_REFRESH_TOKENS=True hone se jti har ~15min mein badalta hai,
   isliye "sirf ek device revoke karo" fragile ho jaata bina naye
   stable session-id claim ke). Iski jagah: login history (existing
   LoginEvent model se, koi naya table nahi) + "Logout Everywhere"
   button jo user ke SAARE outstanding refresh tokens blacklist kar
   deta hai (current device sameet — Google/GitHub jaisa "sign out
   everywhere" behavior). SettingsPage.jsx mein "Security" section.

🔮 PHASE F (pehle "Phase D" tha) → Future, scope mein nahi abhi:
   - Approval workflows (invoice/discount approval)
   - Departments/Branches

═══════════════════════════════════════
HONEST FLAGS — ASSUME NAHI KIYA (updated)
═══════════════════════════════════════
1. ✅ Resolved: migration existing data touch karta hai — har baar
   isolated sandbox mein verify hua, backup pattern follow hua
2. ✅ Resolved: Phase A ka permission-check gate ab billing/inventory
   dono apps ke saare views mein wire ho chuka hai
3. ✅ Resolved: Role-permission exact mapping finalize ho chuki
   (44 permissions, ARCHITECTURE.md mein documented)
4. ✅ Resolved: SimpleJWT device-session/logout-everywhere ban chuka —
   par precise per-device revoke NAHI (Phase C part 2 ka design note
   dekho upar) — ROTATE_REFRESH_TOKENS ki wajah se jaanbujh kar
   simplified rakha.
5. ✅ Resolved: Founder Edit Mode ka blanket-True gap Stage B mein
   explicitly close hua — ab tenant ke actual Owner role permission-set
   ke against fresh check hota hai, blanket bypass nahi.
6. 🆕 NAYA FLAG (still accurate): Primary Owner ka DB constraint sirf
   "at most one" enforce karta hai (Postgres partial unique index) —
   "at least one" (never zero) purely procedurally guarantee hoti hai
   (registration + backfill + atomic handoff + Stage D guards), koi
   DB-level trigger nahi hai. Design decision hai, bug nahi.
7. 🆕 NAYA FLAG (Stage E se pata chala): reset_user_password endpoint
   (superadmin/views.py) pehle ZERO audit trail ke saath tha — koi
   reason, koi log, kuch nahi. Stage E ne isko account_recovery
   Platform Case ke through wrap kiya (ab reason + notes + case record
   + AuditLog mandatory hai). Yeh gap kaise mila iska credit: Stage E
   design karte waqt superadmin/views.py explicitly check kiya gaya —
   par POORA file audit nahi hua abhi, sirf yeh ek function. Baaki
   Founder actions us file mein similar gap rakh sakte hain — flag
   kiya hua hai, resolve nahi hua.
8. 🆕 NAYA FLAG (Phase C se pata chala): 'role.manage_custom' permission
   Phase A se hi seed thi (migration 0002, comment mein "Create / Edit
   / Delete Custom Roles (Pro/Enterprise)" likha hua tha) — is feature
   ka poora groundwork pehle se ready tha, sirf endpoints/UI missing
   the. Design decision, bug nahi — par worth noting ki plan se aage
   ka groundwork already exist karta tha bina explicitly track kiye.
9. 🆕 NAYA FLAG (Phase C part 2 se pata chala): Custom role CREATE sirf
   Pro/Enterprise/Admin-Grant pe gated hai — EDIT/DELETE existing
   custom roles kisi bhi plan pe allowed hai (downgrade ke baad bhi).
   Jaanbujh kar — downgrade hone pe existing setup retroactively
   todna nahi chahte. Agar future mein yeh strictness badalni ho,
   yahan flag hai.
