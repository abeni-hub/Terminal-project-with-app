# Addis Ababa Transport Office (AATO) — Terminal Digital Roster & Fleet Dispatch Management System

> **Current System Status**: `100% OPERATIONAL & VERIFIED` (Build & Tests Passing: Backend NestJS + Frontend Next.js 16 + FastAPI ALPR Microservice)

---

## 📑 Executive Summary

The **Addis Ababa Transport Office (AATO) Terminal Digital Roster System** is an enterprise-grade municipal transport and terminal management platform. It automates weekly fleet scheduling, terminal queue management, dispatcher assignments, violation handling, departures, and fee collection across all major terminals in Addis Ababa (Megenagna, Mercato, Bole, Piazza, Kaliti, Akaki).

The system integrates **Automatic License Plate Recognition (ALPR)** powered by OpenCV and PaddleOCR as the primary automated vehicle check-in mechanism, paired with an intelligent **Manual Dispatcher Fallback Queue Engine** that handles plate searches, visual status flags, unassigned vehicle violation flags, loading bays, and departure fee receipts.

---

## 🚀 System Architecture

```
                      ┌─────────────────────────────────────────────────────────┐
                      │                 Hardware / Video Input                  │
                      │  IP Cameras (RTSP) | USB Webcams | Android IP | Mocks   │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                      ┌─────────────────────────────────────────────────────────┐
                      │    Standalone ALPR Recognition Microservice (Python)    │
                      │  FastAPI + OpenCV + PaddleOCR Plate Normalization Engine│
                      └────────────────────────────┬────────────────────────────┘
                                                   │ POST /api/v1/recognition/process
                                                   ▼
                      ┌─────────────────────────────────────────────────────────┐
                      │        Core Enterprise Backend API (NestJS + TypeScript)│
                      │  • Weekly Roster & Terminal Binding Engine              │
                      │  • Live Queue & Journey State Machine                   │
                      │  • Server-Side Pagination & Audit Logger                │
                      │  • WebSocket Gateway (Socket.IO Event Stream)           │
                      └──────────────┬───────────────────────────┬──────────────┘
                                     │                           │
                        Prisma ORM   │                           │ Real-time Events
                                     ▼                           ▼
                      ┌───────────────────────────┐ ┌───────────────────────────┐
                      │   PostgreSQL Database     │ │   Next.js 16 Frontend UI  │
                      │  (Relational Data Store)  │ │   (Tailwind, Glassmorphism│
                      │                           │ │    Server DataTable, ALPR)│
                      └───────────────────────────┘ └───────────────────────────┘
```

---

## 🎯 Current Implementation Status

| Component | Status | Key Implemented Features |
| :--- | :---: | :--- |
| **Weekly Planning Engine** | `COMPLETED` | 5-step wizard, terminal-dispatcher binding, origin/dest validation, distinct route assignments, auto-generation preview, publish/lock cycle. |
| **Dispatcher Scoped Access** | `COMPLETED` | Single terminal restriction, ISO active week scoping (`getCurrentWeekNumber()`), assigned-routes-only filtering. |
| **Live Dispatcher Queue** | `COMPLETED` | Dual-mode queueing (ALPR primary + Manual fallback), state transitions (`WAITING` ➔ `LOADING` ➔ `DISPATCHED`), departure fee (25.00 ETB) with `REC-XXXXXX` receipt generation. |
| **Car Plate Search & Flags** | `COMPLETED` | Live plate query + all-fleet vehicles dropdown badged with 🟢 `[ASSIGNED]` vs 🔴 `[UNASSIGNED]`. |
| **Violation & Override Engine**| `COMPLETED` | Unassigned vehicles gracefully admitted into queue with `isViolation: true` and `WRONG_VEHICLE_GROUP` logging; non-blocking `Dispatch In (Violation)` flow. |
| **Enterprise Pagination** | `COMPLETED` | Server-side metadata (`data`, `total`, `page`, `pageSize`, `totalPages`) + client-side jump navigation (`«`, `‹`, `›`, `»`) across all 11 core data tables. |
| **ALPR Vision Microservice** | `COMPLETED` | Multi-source camera ingestion (USB, RTSP, Android IP Webcam, Synthetic Mock), PaddleOCR text extraction, confidence scoring, unknown plate queue. |
| **Role-Based Access Control** | `COMPLETED` | JWT authentication, fine-grained permission matrix, multi-tenant terminal isolation for `SUPER_ADMIN`, `PLANNER`, and `DISPATCHER`. |

---

## 🏛️ Key Roles & Workflow Rules

### 1. Municipal Planner (`PLANNER`)
* **Role Focus**: Strategic scheduling, fleet group rotation, and route planning.
* **Weekly Assignment Rules**:
  1. **Single Terminal Binding**: A dispatcher can belong to only one terminal (`user.terminalId`).
  2. **Terminal Matching**: For any route assignment, either the route's **Origin Terminal** or **Destination Terminal** must match the dispatcher's terminal.
  3. **Distinct Dispatchers per Route**: Multiple dispatchers can belong to the same terminal, but on any given route, only one dispatcher from that terminal can be assigned.
  4. **Publishing**: Assignments start in `DRAFT`. Once published, they become `PUBLISHED`/`LOCKED` and immediately activate for dispatchers.

### 2. Terminal Dispatcher (`DISPATCHER`)
* **Role Focus**: Yard operations, vehicle check-in, bay assignment, departure clearance, and fee collection.
* **Access Scoping**:
  * Scoped strictly to the **current active ISO week**.
  * Displays **only routes assigned to the logged-in dispatcher**.
  * Hides all other terminals, unassigned routes, and past/future draft weeks.
* **Queue Lifecycle**:
  1. **Vehicle Arrival / Check-in**:
     - **Automated (ALPR)**: Camera scans vehicle plate upon gate entry.
     - **Manual Fallback**: Dispatcher searches or selects plate from the all-fleet dropdown.
     - **Assigned Vehicles (🟢)**: Enters `WAITING` queue with standard priority.
     - **Unassigned Vehicles (🔴)**: Admitted into `WAITING` queue with violation flag (`isViolation: true`).
  2. **Admit to Yard (`Dispatch In`)**:
     - Vehicle moves from `WAITING` ➔ `LOADING` status.
     - Violation entries use `Dispatch In (Violation)` (amber button) to admit the vehicle without operational gridlock.
  3. **Clearance & Departure (`Dispatch Out`)**:
     - Dispatcher collects departure tariff (`25.00 ETB`).
     - System issues receipt (`REC-XXXXXX`), calculates journey cycle time, and moves vehicle to `DISPATCHED`.

### 3. System Administrator (`SUPER_ADMIN`)
* **Role Focus**: System governance, terminal and route configuration, fleet registry, camera hardware integration, device health monitoring, and audit log compliance.

---

## 👤 Test Accounts & Seed Credentials

All accounts use the default password: **`password123`**

| Role | Name | Email | Assigned Terminal / Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Abebe Bekele | `abebe@aato.gov.et` | City-wide / All Terminals |
| **Super Admin** | Bethel Alemu | `bethel@aato.gov.et` | City-wide / All Terminals |
| **Municipal Planner** | Sara Tadesse | `sara@aato.gov.et` | City-wide Weekly Roster Planner |
| **Municipal Planner** | Meron Tesfaye | `meron@aato.gov.et` | City-wide Weekly Roster Planner |
| **Terminal Dispatcher** | Dawit Kebede | `dawit@aato.gov.et` | Mercato Terminal (`t2`) |
| **Terminal Dispatcher** | Helen Girma | `helen@aato.gov.et` | Megenagna Terminal (`t1`) |
| **Terminal Dispatcher** | Solomon Haile | `solomon@aato.gov.et` | Mercato Terminal (`t2`) |

---

## 📦 Core Data Modules & Pagination Matrix

All endpoints and UI data tables are equipped with standardized server-side pagination:

| Page / Module | Route / Endpoint | Pagination Support | Filtering / Actions |
| :--- | :--- | :---: | :--- |
| **Users** | `/users` ➔ `GET /api/v1/users` | ✅ Server-side | Role, Terminal, Status filter |
| **Terminals** | `/terminals` ➔ `GET /api/v1/terminals` | ✅ Server-side | Status, Capacity, Search |
| **Routes** | `/routes` ➔ `GET /api/v1/routes` | ✅ Server-side | Origin, Destination, Status |
| **Vehicles** | `/vehicles` ➔ `GET /api/v1/vehicles` | ✅ Server-side | Plate Search, Group, Status |
| **Vehicle Groups** | `/vehicle-groups` ➔ `GET /api/v1/vehicle-groups` | ✅ Server-side | Group Name, Vehicle Count |
| **Weekly Rosters** | `/rosters` ➔ `GET /api/v1/assignments` | ✅ Server-side | Week Number, Year, Status |
| **Live Queue** | `/queue` ➔ `GET /api/v1/queue` | ✅ Server-side | Route, Status, Plate Filter |
| **Violations Log** | `/violations` ➔ `GET /api/v1/violations` | ✅ Server-side | Severity, Status, Vehicle |
| **Overrides** | `/overrides` ➔ `GET /api/v1/overrides` | ✅ Server-side | Status, Approver, Reason |
| **Devices / Cameras** | `/devices` ➔ `GET /api/v1/cameras` | ✅ Server-side | Type, Online Status, Ping |
| **Audit Logs** | `/audit-logs` ➔ `GET /api/v1/audit-logs` | ✅ Server-side | Action, User, Date Range |

---

## 💻 Tech Stack

* **Backend**: NestJS, TypeScript, Prisma ORM, PostgreSQL, Socket.IO, Passport JWT, Bcrypt.
* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons, Glassmorphic UI Design System.
* **Vision / ALPR**: Python 3.10+, FastAPI, OpenCV, PaddleOCR, Uvicorn, Requests.
* **DevOps / Tooling**: Node.js 18+, npm, Prisma Migrate, Git.

---

## 🛠️ How to Run & Verify the System

### 1. Start the NestJS Backend API
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```
* Backend API runs on: `http://localhost:4000`
* Swagger / Health endpoint: `http://localhost:4000/api/v1/health`

### 2. Start the Next.js Frontend Application
```bash
cd project
npm install
npm run dev
```
* Frontend Web App runs on: `http://localhost:3000`

### 3. (Optional) Start the Python ALPR Microservice
```bash
cd recognition-service
pip install -r requirements.txt
python -m app.main
```
* ALPR Microservice runs on: `http://localhost:8000`
* Live Camera Stream: `http://localhost:8000/preview/{camera_id}`

---

## 📚 Master Documentation Files

* **Master Workflow & Roles Guide (Markdown)**: [`PROJECT_WORKFLOW_AND_ROLES_GUIDE.md`](./PROJECT_WORKFLOW_AND_ROLES_GUIDE.md)
* **Master Workflow & Roles Guide (Printable HTML)**: [`PROJECT_WORKFLOW_AND_ROLES_GUIDE.html`](./PROJECT_WORKFLOW_AND_ROLES_GUIDE.html)
* **Master Workflow & Roles Guide (Microsoft Word Document)**: [`PROJECT_WORKFLOW_AND_ROLES_GUIDE.docx`](./PROJECT_WORKFLOW_AND_ROLES_GUIDE.docx)
* **Step-by-Step Progress & Architecture Log**: [`PROGRESS_LOG.md`](./PROGRESS_LOG.md)
* **Technical Walkthrough & Verification Summary**: Available in the agent system walkthrough log.

---
*Addis Ababa Transport Office (AATO) — Municipal Fleet & Terminal Operations Platform © 2026*
