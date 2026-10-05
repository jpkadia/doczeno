# Doczeno — Multi-Tenant Healthcare Website Platform

Doczeno is an enterprise-grade multi-tenant platform tailored for independent medical practices, multi-specialty hospitals, and affiliated clinical doctors.

---

## 1. Architecture Overview

The system strictly decouples the client-facing website rendering layer from the secure healthcare API server into two standalone applications:

```text
Doczeno/
├── frontend/             # Next.js 15 + TypeScript Application
│   ├── src/app/          # App Router (Public Doctor Websites, Portals)
│   ├── src/components/   # Design System & Clinical Primitives (Tailwind + Radix)
│   ├── src/lib/          # Centralized Typed API Client
│   └── src/types/        # Shared Client Domain Types
├── backend/              # Node.js + Express.js + TypeScript API Server
│   ├── src/config/       # Typed Server Environment Layer (Zod)
│   ├── src/db/           # Mongoose Connection with Pool Management
│   ├── src/models/       # 14 Normalized Domain Entities & Indexes
│   ├── src/middleware/   # Auth, RBAC, Rate-Limiting, Error Handling
│   ├── src/services/     # Business Logic & Runtime Data Inheritance Engine
│   ├── src/routes/       # Versioned REST API (/api/v1/...)
│   └── src/tests/        # In-process Supertest & Vitest Suites
├── env.txt               # Secret Credentials (Untracked)
└── package.json          # Root Monorepo Workspace Configuration
```

---

## 2. Multi-Tenant Website Archetypes

| Website Archetype | Public URL Pattern | Admin Path | Ownership & Controls |
| :--- | :--- | :--- | :--- |
| **Type A: Independent Doctor** | `doctorwebsite.in/dr-parth-kadiya` | `/dr-parth-kadiya/admin/login` | Doctor controls entire website, clinic profile, photo, hours, appointments. |
| **Type B: Hospital / Clinic** | `doctorwebsite.in/apollo` | `/apollo/login` | Hospital is source-of-truth for branding, address, theme, favicon, doctor roster. |
| **Type C: Hospital Doctor** | `doctorwebsite.in/apollo/dr-rajiv-shah` | `/apollo/dr-rajiv-shah/admin/login` | Child of parent hospital; inherits hospital branding, address, and theme at runtime. |
| **Superadmin Portal** | Platform Root | `/superadmin/login` | Platform-wide administrative authority. |

---

## 3. Data Inheritance Rules

Hospital/clinic data serves as the **source of truth** for common information across child clinicians:
* **Child Hospital Doctor Runtime Inherits**:
  * Hospital Name
  * Hospital Logo
  * Hospital Gallery Photos
  * Hospital Address (Street, City, State, Pincode)
  * Hospital Theme
  * Hospital Favicon
  * Hospital Browser Tab Title
* **Zero Duplication**: These values are **never copied** into doctor documents.
* **Dynamic Resolution**: Resolved at runtime via `/api/v1/websites/effective/:slug`. Any update to hospital information automatically cascades to all affiliated doctor sites immediately.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Action / Resource | SUPERADMIN | HOSPITAL_ADMIN | HOSPITAL_DOCTOR | INDEPENDENT_DOCTOR |
| :--- | :---: | :---: | :---: | :---: |
| **Platform Management** | Full | Denied | Denied | Denied |
| **Manage Own Hospital Info** | Yes | Yes (Own Org Only) | Denied | Denied |
| **Manage Hospital Theme/Favicon** | Yes | Yes (Own Org Only) | Denied | Denied |
| **Manage Hospital Doctors** | Yes | Yes (Own Org Only) | Denied | Denied |
| **Update Own Doctor Profile** | Yes | Yes (Under Own Org) | Yes (Self Only) | Yes (Self Only) |
| **Manage Independent Clinic** | Yes | Denied | Denied | Yes (Self Only) |
| **Cross-Tenant Access** | Allowed | Denied | Denied | Denied |

---

## 5. Security & Verification Commands

All checks run via code-level, static, and non-browser automated methods:

```bash
# Run full automated test suite (backend Supertest + frontend Vitest)
npm run test

# Run strict TypeScript compilation check across all workspaces
npm run typecheck

# Build both applications for production
npm run build
```
