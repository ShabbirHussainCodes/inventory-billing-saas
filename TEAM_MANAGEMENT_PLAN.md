# 🗺️ BILLINGMARS — TEAM MANAGEMENT SYSTEM (MASTER PLAN — UPDATED)

> Yeh original plan ka updated version hai. Jo bhi ✅ COMPLETED marked hai, woh
> real code mein ban chuka hai aur sandbox-verified hai. Jo 🔄 IN PROGRESS /
> ⏳ PENDING hai, woh design-locked hai but implement nahi hua abhi.

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

CUSTOM ROLES (Phase C — ⏳ NOT STARTED):
   Free        → Nahi milega (sirf 5 system roles)
   Pro/Enterprise → Milega
   Admin Grant → Automatically milega (plan_limits system se)
   Schema already ready hai (Role.tenant nullable) — UI/endpoints bante nahi.

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

⏳ ABHI PENDING (Stage D — neeche dekho): non-Primary Owner aaj bhi
   kisi doosre Owner ko suspend/remove/demote kar sakta hai. Yeh
   Stage D mein band hoga.

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

  ⏳ Stage B — Founder operational parity, routine actions
     has_permission() ka Founder-in-Edit-Mode path harden hoga — abhi
     blanket True return karta hai kisi bhi codename ke liye jab
     Edit Mode ho; isse tenant ke actual Owner role ke permission-set
     ke against check karega (View-As jaisa hi pattern, bas Owner
     role fixed target hai). Phir Founder UI (invite/role-change/
     suspend/remove) Team tab mein wire hoga, Edit Mode-gated.

  ⏳ Stage C — Founder parity, sensitive ownership actions
     remove/suspend/change-role (jab target Owner ho) aur Make
     Primary Owner — Founder-in-Edit-Mode ko allow karega, par
     MANDATORY reason + identity-verification-notes fields ke saath,
     jo alag se distinctly logged hongi (routine actions se separate
     dikhengi audit trail mein).

  ⏳ Stage D — Owner-vs-Owner guards (Primary Owner authority)
     Sirf Primary Owner kisi doosre Owner ko suspend/remove/demote
     kar sakta hai. Non-primary Owners baaki sab kuch waise hi kar
     sakte hain jaise aaj karte hain.

  ⏳ Stage E — Platform Case generic framework
     Model: case_type (enum — primary_transfer, forced_owner_removal,
     account_recovery, fraud_freeze, legal_hold, ...), status
     lifecycle (open → under_review → resolved/rejected — single
     linear flow nahi, real disputes multi-step hote hain), reason,
     identity_verification_notes, created_by, executed_by, timestamps.
     Founder Panel mein naya "Platform Cases" section. Pehle 1-2 case
     types implement honge (likely: forced ownership transfer +
     account recovery).

     Design mein carry karne wale open points (philosophy-level
     decide ho chuka, implementation ke time finalize honge):
     - Kya har case ko ek "severity/urgency" flag chahiye (true
       emergency = turant execute vs contested dispute = cooling-off
       period)?
     - Kya affected business (uske Owners) ko kabhi pata chalna
       chahiye ki unke account pe Platform Case chala — kम se kam
       unke apne Activity Log mein ek trace?
     - created_by/executed_by alag rakhna hai even though abhi dono
       hamesha same (Founder) honge — future mein jab support team
       badhegi, tab dual-control retrofit na karna pade.

═══════════════════════════════════════
BUILD ORDER — ACTUAL STATUS
═══════════════════════════════════════
✅ PHASE A → Core Foundation — DONE
✅ PHASE B → Activity + Team Management UI — DONE
✅ PHASE B.5 → "View As Member" — DONE
✅ PHASE B.6 Stage 1 → Primary Owner core — DONE
✅ PHASE B.6 Stage A → Founder read-only Team visibility — DONE
⏳ PHASE B.6 Stage B → Founder parity, routine actions — NEXT
⏳ PHASE B.6 Stage C → Founder parity, sensitive ownership actions
⏳ PHASE B.6 Stage D → Owner-vs-Owner guards
⏳ PHASE B.6 Stage E → Platform Case framework
⏳ PHASE C → Custom Roles + Refinement (permission editor UI,
   device sessions/logout-everywhere — SimpleJWT exact syntax
   verify karenge implementation ke time)
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
4. ⏳ Abhi bhi open: SimpleJWT device-session/logout-everywhere exact
   syntax — Phase C ke time current docs verify honge
5. 🆕 NAYA FLAG (is discussion se pata chala): aaj ke code mein,
   Founder Edit Mode mein hote hue technically team.* permissions
   ke liye bhi True return kar sakta hai (has_permission() method-
   based hai, permission-category-aware nahi) — koi Founder UI abhi
   isse reach nahi karti, isliye exploitable nahi hai practically,
   par Stage B/C isko explicitly, deliberately design karke close
   karenge, accident se nahi.
6. 🆕 NAYA FLAG: Primary Owner ka DB constraint sirf "at most one"
   enforce karta hai (Postgres partial unique index) — "at least
   one" (never zero) purely procedurally guarantee hoti hai
   (registration + backfill + atomic handoff + future Stage D
   guards), koi DB-level trigger nahi hai. Design decision hai,
   bug nahi.
