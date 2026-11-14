# Transport Terminal Management & ANPR System
## Comprehensive Project Workflow & Role Responsibilities Guide

---

### Core System Concept
This system is an **ANPR-Powered Transport Terminal Entry, Queue Sequencing, Loading Yard, Exit Gate, Fee Collection, and Weekly Roster Management System** designed specifically for commercial and public transport operations (minibuses, coasters, and buses).

> **Important**: This is **NOT** a parking system. Vehicles operate under **Weekly Roster Assignments**. Vehicle groups are scheduled across routes, and ANPR cameras detect arriving and departing vehicles at terminal gates to enforce authorization, calculate turnaround duration, collect dispatch fees, and prevent unauthorized operations.

---

## 1. End-to-End Operational Lifecycle (In Chronological Order)

1. **Phase 1: Master Setup & Foundation (System Admin)**
   - System Admin configures terminals, inter-terminal routes, vehicle fleets, user RBAC accounts, fee rules, and connects Entry/Exit ANPR cameras.
2. **Phase 2: Weekly Planning & Roster Locking (Municipal Planner)**
   - Municipal Planner auto-generates or creates weekly route schedules, resolves conflicts, publishes, and locks the authoritative roster.
3. **Phase 3: Live Gate Arrival & Recognition (ANPR / Dispatcher)**
   - Vehicle arrives at terminal gate $\to$ Entry ANPR camera scans plate $\to$ System checks active weekly roster:
     - **Valid**: Admitted into FIFO queue with status `WAITING` (`PENDING_IN`).
     - **Invalid / Wrong Terminal**: Flagged as `VIOLATION` for supervisor review.
4. **Phase 4: Dispatch In & Yard Loading (Dispatcher)**
   - Dispatcher confirms vehicle arrival into the loading bay (`LOADING`). Passengers board the vehicle.
5. **Phase 5: Exit Gate Detection, Fee Collection & Dispatch Out (ANPR / Dispatcher)**
   - Vehicle arrives at exit gate $\to$ Exit ANPR scans plate (`DETECTED_AT_EXIT`) $\to$ Dispatcher verifies fee, collects payment (Telebirr/CBE Birr/Cash), inputs receipt reference, and confirms departure. Barrier opens and vehicle status becomes `ON_ROUTE`.
6. **Phase 6: Auditing & Analytics (System Admin / Planner)**
   - Every transaction is stamped with an authoritative audit reference (`AUD-XXXX`). Reports on revenue, gate volume, and turnaround are produced.

---

## 2. Role-by-Role Capabilities (What Each Can Do, In Order)

### 2.1 System Administrator (`SUPER_ADMIN`)
| Order | Action / Page | Description |
| :--- | :--- | :--- |
| **Step 1** | **User & RBAC Management** (`/users`, `/roles`) | Create user accounts (Planners, Dispatchers, Auditors), assign them to physical terminals, and set permissions. |
| **Step 2** | **Terminal & Route Setup** (`/terminals`, `/routes`) | Register terminals (GPS coordinates, bay capacity, operational status) and create inter-terminal routes. |
| **Step 3** | **Fleet & Group Management** (`/vehicle-groups`, `/vehicles`) | Create vehicle groups (Group A, Group B) and register fleet vehicles with license plates, models, and capacity. |
| **Step 4** | **ANPR Hardware & Device Onboarding** (`/cameras`, `/devices`) | Configure Entry and Exit ANPR cameras (RTSP URLs, IP addresses, OCR thresholds) and approve mobile devices. |
| **Step 5** | **Fee Tariffs & Policies** (`/dispatch-fees`, `/settings`) | Define departure dispatch fee tariffs by vehicle type (e.g., Minibus = 25 ETB, Coaster = 50 ETB, Bus = 75 ETB). |
| **Step 6** | **High-Level Approvals & Audit Monitoring** (`/overrides`, `/audit-logs`) | Review and authorize supervisor overrides using Supervisor PIN and inspect immutable audit trail logs. |

---

### 2.2 Municipal Planner (`MUNICIPAL_PLANNER`)
| Order | Action / Page | Description |
| :--- | :--- | :--- |
| **Step 1** | **Demand & Route Analytics** (`/dashboard`, `/reports`) | Inspect route demand, passenger volumes, peak gate hours, and vehicle group utilization. |
| **Step 2** | **Auto-Generate / Create Weekly Roster** (`/rosters`) | Select operating week (e.g. Week 38) and click *Auto-Generate Schedule* to distribute vehicle groups across routes round-robin with conflict prevention. |
| **Step 3** | **Review & Dispatcher Validation** (`/rosters`) | Review draft assignments and verify assigned dispatchers belong to origin or destination terminals (`[DRAFT]` $\to$ `[REVIEWED]`). |
| **Step 4** | **Publish Weekly Roster** (`/rosters`) | Publish the schedule (`[REVIEWED]` $\to$ `[PUBLISHED]`). Gate ANPR cameras immediately begin recognizing vehicles belonging to scheduled groups. |
| **Step 5** | **Lock Authoritative Roster** (`/rosters`) | Freeze roster into official record (`[PUBLISHED]` $\to$ `[LOCKED]`). Ordinary edits are blocked; unassigned vehicle arrivals trigger gate violations. |
| **Step 6** | **Archive Completed Rosters** (`/rosters`) | Archive historical rosters (`[LOCKED]` $\to$ `[ARCHIVED]`) once the operating week concludes. |

---

### 2.3 Terminal Dispatcher (`DISPATCHER`)
| Order | Action / Page | Description |
| :--- | :--- | :--- |
| **Step 1** | **Monitor Live Console & Recognition Stream** (`/queue`, `/recognition/dashboard`) | Open the real-time FIFO queue console filtered to their assigned terminal. Monitor optical recognition scans and audio alerts. |
| **Step 2** | **Vehicle Arrival Verification** (`/queue` $\to$ *Incoming / Pending In*) | ANPR camera detects arriving plate. If authorized on weekly roster, enters queue as `WAITING`. If camera is offline, dispatcher uses *Manual Check-In*. |
| **Step 3** | **Dispatch In $\to$ Loading Yard** (`/queue` $\to$ *Loading Yard*) | When vehicle enters the loading bay, dispatcher clicks *Dispatch In*. Vehicle state changes to `LOADING` while passengers board. |
| **Step 4** | **Exit Gate ANPR Detection** (`/queue` $\to$ *Exit Gate / Pending Out*) | Fully loaded vehicle approaches the exit gate. Exit ANPR camera scans plate and automatically flags vehicle as `DETECTED_AT_EXIT`. |
| **Step 5** | **Fee Collection & Dispatch Out** (`/queue`) | Dispatcher clicks *Confirm & Exit / Dispatch Out*, verifies fee (e.g. 25 ETB), selects payment method (Telebirr, CBE Birr, Cash, Electronic), enters Transaction ID, and confirms. Gate opens and vehicle state becomes `ON_ROUTE`. |
| **Step 6** | **Resolve Gate Violations** (`/violations` or `/queue` $\to$ *Violations Review*) | Evaluate unassigned or wrong-terminal vehicles: (A) Admit / Override (enter mandatory supervisor remark for surge/emergency) or (B) Turn Away / Reject. |

---

## 3. Roles & Permissions Matrix

| System Feature / Domain | System Admin | Municipal Planner | Terminal Dispatcher |
| :--- | :---: | :---: | :---: |
| **User & Role Management (RBAC)** | ✅ Full Access | ❌ No Access | ❌ No Access |
| **Terminal & Route Configuration** | ✅ Full Access | 👁️ View Only | ❌ No Access |
| **Fleet & Vehicle Group Setup** | ✅ Full Access | ✅ Can Manage | 👁️ View Only |
| **ANPR Camera & Device Setup** | ✅ Full Access | ❌ No Access | ❌ No Access |
| **Weekly Roster Lifecycle (Draft $\to$ Lock)** | ✅ Full Access | ✅ Primary Owner | 👁️ View Only |
| **Live Gate Check-In & Queue** | ✅ Full Access | 👁️ View Only | ✅ Primary Operator |
| **Dispatch In (Yard Loading)** | ✅ Full Access | ❌ No Access | ✅ Primary Operator |
| **Fee Collection & Dispatch Out** | ✅ Full Access | ❌ No Access | ✅ Primary Operator |
| **Gate Violations & Overrides** | ✅ Full Approver | 👁️ View Only | ✅ First-line Resolver |
| **Financial & Operational Reports** | ✅ Full Access | ✅ Full Access | 👁️ Terminal Limited |
| **System Audit Trail Logs** | ✅ Full Access | 👁️ View Only | ❌ No Access |
