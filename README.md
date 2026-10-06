# Doczeno — Multi-Tenant Healthcare Website Platform

Doczeno is an enterprise-grade multi-tenant platform tailored for independent medical practices, multi-specialty hospitals, and affiliated clinical doctors. It provides automated deterministic website generation across 3 specialized healthcare themes, role-based administration panels, appointment management, server-side Gemini 3.8 Flash text generation with review pipelines, tenant-scoped RAG knowledge retrieval, an emergency-safe public chatbot, and an authenticated practice management AI copilot.

---

## 1. System Architecture

The platform enforces a strict physical separation between the client-facing presentation application and the secure backend API server:

```text
Doczeno/
├── frontend/                     # Next.js 15 (App Router) + TypeScript
│   ├── src/app/                  # Public Websites (/:slug, /:orgSlug/:doctorSlug) & Admin Panels
│   ├── src/components/           # Clinical UI Primitives, 3 Deterministic Themes, Chatbots
│   ├── src/lib/                  # Centralized Typed API Client
│   └── src/types/                # Shared Domain Types
├── backend/                      # Node.js + Express.js + TypeScript REST API
│   ├── src/config/               # Typed Zod Environment Layer & Safe Credential Loader
│   ├── src/db/                   # MongoDB Connection with Health Checks & Resilient Pooling
│   ├── src/models/               # Mongoose Domain Schemas, Compound Indexes & Text Indexes
│   ├── src/middleware/           # Authentication, RBAC, Sliding Rate Limiting, Security Headers
│   ├── src/services/             # Business Logic, RAG Knowledge Retrieval, AI Text Engine
│   ├── src/routes/               # Versioned API Endpoints (/api/v1/...)
│   └── src/tests/                # In-Process Automated Supertest & Vitest Suites (145+ tests)
├── .env                          # Local Environment Configuration (Strictly Untracked by Git)
├── .gitignore                    # Robust Protection of Environment & Secret Artifacts
└── package.json                  # Root Monorepo Workspace Configuration
```

---

## 2. Multi-Tenant Archetypes & Route Matrix

| Website Archetype | Public Route Pattern | Admin Route Pattern | Ownership & Data Boundaries |
| :--- | :--- | :--- | :--- |
| **Type A: Independent Doctor** | `/:doctorSlug` | `/:doctorSlug/admin` | Solo clinician manages profile, clinic details, schedule, gallery, branding, and appointments. |
| **Type B: Hospital / Clinic** | `/:organizationSlug` | `/:organizationSlug/admin` | Organization is the single source of truth for branding, address, theme, favicon, and affiliated doctors. |
| **Type C: Hospital Doctor** | `/:organizationSlug/:doctorSlug` | `/:organizationSlug/:doctorSlug/admin` | Affiliated clinician; dynamically inherits hospital address, logo, theme, and tab title at runtime without data duplication. |
| **Platform Superadmin** | Root Platform | `/superadmin` | Global governance: tenant onboarding, status toggling, doctor activation, and publish controls. |

---

## 3. Data Inheritance & Zero-Duplication Storage Engine

Hospital/clinic records serve as the single source of truth for common institutional information:
* **Runtime Dynamic Inheritance**:
  * Hospital Name & Type
  * Hospital Logo & Gallery Photos
  * Physical Address (Street, City, State, Pincode)
  * Active Website Theme (`clinical-editorial`, `modern-minimal`, `vital-compact`)
  * Favicon & Browser Tab Title
  * Clinic Telephone & Reception WhatsApp
* **Zero Duplication**:
  * Doctor documents in MongoDB store **only** doctor credentials (`doctorName`, `gender`, `degree`, `specialization`, `yearsOfExperience`, `bio`, `doctorPhoto`, `consultationHours`, `weeklyOff`).
  * No institutional address, logo, or theme data is duplicated into doctor records.
* **Instant Cascade**:
  * Public requests to `/:organizationSlug/:doctorSlug` resolve effective data dynamically via `/api/v1/websites/effective/:orgSlug/:doctorSlug`.
  * When a hospital updates its address or theme, all affiliated clinician websites reflect the changes immediately without batch synchronization.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Resource / Action | SUPERADMIN | HOSPITAL_ADMIN | HOSPITAL_DOCTOR | INDEPENDENT_DOCTOR |
| :--- | :---: | :---: | :---: | :---: |
| **Global System Governance** | Full Access | Denied | Denied | Denied |
| **Manage Hospital Identity & Address** | Allowed | Allowed (Own Org Only) | Denied (Read-Only) | Denied |
| **Manage Hospital Theme & Favicon** | Allowed | Allowed (Own Org Only) | Denied (Inherited) | Denied |
| **Add / Deactivate Hospital Doctors** | Allowed | Allowed (Own Org Only) | Denied | Denied |
| **Manage Own Doctor Profile & Hours** | Allowed | Allowed (Under Own Org) | Allowed (Self Only) | Allowed (Self Only) |
| **Manage Independent Practice & Logo**| Allowed | Denied | Denied | Allowed (Self Only) |
| **Access Other Tenants' Data** | Allowed | Denied (403) | Denied (403) | Denied (403) |

---

## 5. Security & Production Hardening Architecture

1. **Authentication & Session Management**:
   - Passwords hashed using `bcryptjs` with salt work factor of 12.
   - JWT tokens signed with `AUTH_SECRET` and delivered in secure, `HttpOnly`, `SameSite=Lax` cookies (`doczeno_session`).
   - Generic authentication failure messages prevent account enumeration.
   - Brute-force protection via sliding window rate limiter (20 attempts per 15 minutes).
2. **Tenant Isolation**:
   - Queries strictly enforced at database layer using tenant IDs (`organizationId`, `doctorId`), never relying on client-supplied slugs or parameters.
   - Cross-tenant lookups and mutations trigger immediate `403 Forbidden` (`TENANT_ACCESS_DENIED`, `DOCTOR_ACCESS_DENIED`).
3. **File Upload Security**:
   - Strict size caps: Doctor Photo (3 MB), Clinic Logo (2 MB), Gallery (3 MB, max 6 items).
   - Binary magic byte inspection (`verifyImageFileSignature`) prevents extension spoofing (e.g. executables masked as JPEG).
   - Filenames sanitized with safe alphanumeric replacement; keys generated with server-side random hashes (`doczeno/:category/:base_:randomId`).
   - Cross-tenant media deletion strictly blocked.
4. **AI & Gemini Security**:
   - Gemini API keys are backend-only; never exposed to the frontend bundle or client network traffic.
   - Public website page requests **never** invoke the Gemini SDK.
   - Server-side prompt injection defense strips delimiters, enforces fact constraints, and filters clinical diagnosis/treatment requests.
   - AI-generated text follows a strict `DRAFT` -> `APPROVED` -> `PUBLISHED` review lifecycle.
5. **API Hardening**:
   - Helmet security headers enabled (`X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security`).
   - CORS restricted to configured `FRONTEND_URL` origin.
   - Production error handler masks internal 500 errors to `"Internal server error"` and strips stack traces and connection strings.
6. **Publish State Governance**:
   - Public website engine respects 5 discrete publish states: `DRAFT`, `GENERATING`, `REVIEW`, `PUBLISHED`, and `SUSPENDED`.
   - Only websites in `PUBLISHED` state are visible to public visitors.

---

## 6. Environment Variables (Names Only)

> **Important**: Never commit secrets or API keys. Set these in your server environment or deployment platform (e.g. AWS ECS, Render, Vercel, Railway).

### Backend (`backend/.env` or deployment environment)
* `PORT` — Port number for Express server (default: `5000`)
* `NODE_ENV` — Environment mode (`development`, `test`, `production`)
* `MONGODB_URI` — MongoDB Atlas or replica set connection string
* `AUTH_SECRET` — Cryptographic secret key for signing JWT tokens (min 32 characters)
* `FRONTEND_URL` — Allowed origin URL for CORS policy (e.g. `https://doczeno.com`)
* `CLOUDINARY_URL` — Cloudinary storage connection string (optional)
* `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud identifier (optional)
* `CLOUDINARY_API_KEY` — Cloudinary access key (optional)
* `CLOUDINARY_API_SECRET` — Cloudinary secret key (optional)
* `R2_ACCOUNT_ID` — Cloudflare R2 Account ID (optional)
* `R2_ACCESS_KEY_ID` — Cloudflare R2 Access Key ID (optional)
* `R2_SECRET_ACCESS_KEY` — Cloudflare R2 Secret Access Key (optional)
* `R2_BUCKET_NAME` — Cloudflare R2 bucket name (optional)
* `R2_PUBLIC_BASE_URL` — Cloudflare R2 public CDN URL (optional)
* `BREVO_API_KEY` — Transactional email API key (optional)
* `BREVO_SENDER_EMAIL` — Verified sender email address (optional)
* `GEMINI_API_KEY` — Google Gemini API key for server-side AI tasks
* `GEMINI_MODEL` — Configured Gemini model (default: `gemini-3.8-flash`)
* `SUPERADMIN_EMAIL` — Initial platform superadmin account email
* `SUPERADMIN_PASSWORD` — Initial platform superadmin account password

### Frontend (`frontend/.env.local` or deployment environment)
* `NEXT_PUBLIC_API_URL` — Public Express API endpoint (e.g. `http://localhost:5000/api/v1` or `https://api.doczeno.com/api/v1`)

---

## 7. Local Setup & Execution Guide

### Prerequisites
* Node.js v20.x or v22.x LTS
* npm v10.x+
* Running MongoDB instance (local or MongoDB Atlas)

### Installation
```bash
# Clone the repository
git clone https://github.com/doczeno/doczeno.git
cd Doczeno

# Install workspace dependencies across root, frontend, and backend
npm install
```

### Starting Development Servers
```bash
# Start backend API server (runs on http://localhost:5000)
npm run dev:backend

# In a separate terminal, start frontend application (runs on http://localhost:3000)
npm run dev:frontend
```

---

## 8. Verification & Testing Commands

Doczeno is verified strictly through automated in-process test suites, static analysis, type checking, and production builds:

```bash
# 1. Run all test suites across frontend and backend (188+ tests)
npm run test

# 2. Run backend test suite only (Supertest API integration & unit tests)
npm run test:backend

# 3. Run frontend test suite only (Vitest component & logic tests)
npm run test:frontend

# 4. Strict TypeScript static analysis check (backend + frontend)
npm run typecheck

# 5. Production build of both standalone applications
npm run build
```

---

## 9. Production Deployment Notes

* **Frontend Deployment** (e.g. Vercel, AWS Amplify, Docker):
  - Set `NEXT_PUBLIC_API_URL` to the public HTTPS URL of the backend API (e.g. `https://api.doczeno.com/api/v1`).
  - Deploy standard Next.js standalone build using `next build` and `next start`.
* **Backend Deployment** (e.g. AWS ECS, Render, Railway, DigitalOcean):
  - Deploy compiled Node.js server from `backend/dist/server.js` using a process manager (`pm2 start dist/server.js -i max`) or container.
  - Set `NODE_ENV=production` to enable automatic error masking and HTTPS-only cookie flags.
  - Ensure `FRONTEND_URL` exactly matches the public domain of the frontend application for CORS validation.
  - Configure MongoDB connection string with SSL/TLS (`tls=true`) and connection pool limits (`maxPoolSize=50`).
