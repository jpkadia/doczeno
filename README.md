# Doczeno — Healthcare Practice Web Platform

Doczeno is an enterprise multi-tenant platform designed for private medical practices, clinics, and multi-specialty hospitals. It provides automated deterministic website generation across specialized clinical themes, role-based administration consoles, appointment scheduling, tenant-isolated knowledge retrieval, patient assistance, and an authenticated practice management copilot.

---

## 1. Platform Modules & Capabilities

### Multi-Tenant Practice Types
* **Only Doctor**: Autonomous clinicians manage their clinical profile, degrees, specialization, consultation schedule, clinic address, facility gallery, branding, and appointments.
* **Hospital or Clinic (Facility)**: Healthcare organizations act as the central authority for branding, physical address, facility gallery, active theme, and affiliated doctor rosters.
* **Hospital-Affiliated Doctor**: Affiliated clinicians maintain their professional credentials and schedule while dynamically inheriting the parent hospital's address, logo, active theme, and contact channels at runtime without data duplication.
* **Platform Superadmin**: Centralized administrative governance for tenant lifecycle status, doctor activation, and website publication state.

### Deterministic Clinical Themes
* **Clinical Editorial**: Academic, institutional layout for established medical centers and specialists.
* **Modern Minimal**: Clean, contemporary interface tailored for outpatient practices and clinics.
* **Vital Compact**: Fast, high-density presentation optimized for primary care and routine consultations.

### Appointment Workflow
* Patient appointment request workflow with date and time preference selection.
* Role-scoped administrative status updates: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.
* Live database retrieval with dedicated empty-state feedback.

### Practice QR Code Engine
* Dynamic QR code generation for every registered practice and doctor profile.
* Embedded clinic/hospital branding in QR output.
* Dual environment support for local development and live public domains.

### Practice AI Copilot & Patient Assistant
* **Administrative Copilot**: Role-authorized management assistant capable of querying affiliated doctors, appointments, and updating practice profile content.
* **Public Patient Assistant**: Multi-lingual, empathetic conversational assistant providing verified practice timings, location, and services while upholding strict medical emergency safety boundaries and refusing medical prescriptions.

---

## 2. Route Matrix

| Entity Type | Public Website Route | Admin Console Route | Access Control Scope |
| :--- | :--- | :--- | :--- |
| **Only Doctor** | `/:slug` | `/:slug/admin` | Private clinician credentials required |
| **Hospital / Clinic** | `/:slug` | `/:slug/admin` | Facility administrator credentials required |
| **Hospital Doctor** | `/:slug/:doctorSlug` | `/:slug/:doctorSlug/admin` | Affiliated doctor credentials required |
| **Platform Governance** | Root Platform | `/superadmin` | Master governance credentials required |

> **Security Note**: Public website pages do not expose direct administrator login buttons. Practice administrators access their respective console via manual URL navigation with session timeout protections.

---

## 3. Security & Governance

1. **Role-Based Access Control (RBAC)**: Strict authorization checks enforce complete data isolation between separate healthcare practices and facilities.
2. **Session Protection**: Automatic inactivity guards terminate idle sessions after 15 minutes of inactivity to maintain healthcare confidentiality.
3. **Tenant Boundary Enforcement**: Queries and mutations are scoped strictly by authenticated account tenant identifiers. Cross-tenant access attempts are strictly rejected.
4. **Media Validation**: File upload dimensions and binary signatures are verified to prevent file extension spoofing.
5. **Publish State Management**: Public directory routes only expose verified websites in `PUBLISHED` status.

---

## 4. Environment Configuration (Variable Keys Only)

> **Important**: Never commit secrets, passwords, or credentials to version control. Configure these variables directly in your host environment.

### Backend Server (`backend/.env`)
* `PORT` — Port number for the application API server
* `NODE_ENV` — Runtime environment mode (`development`, `production`)
* `MONGODB_URI` — Primary database connection endpoint
* `AUTH_SECRET` — Cryptographic secret key used for session token signing
* `FRONTEND_URL` — Public domain origin for cross-origin request validation
* `CLOUDINARY_URL` — Media storage connection string
* `CLOUDINARY_CLOUD_NAME` — Storage cloud identifier
* `CLOUDINARY_API_KEY` — Storage access key
* `CLOUDINARY_API_SECRET` — Storage secret key
* `GEMINI_API_KEY` — AI services engine access key
* `GEMINI_MODEL` — Configured AI model identifier
* `BREVO_API_KEY` — Transactional email delivery service key
* `BREVO_SENDER_EMAIL` — Verified transactional sender email address
* `SUPERADMIN_EMAIL` — Platform master governance account email
* `SUPERADMIN_PASSWORD` — Platform master governance account password

### Client Application (`frontend/.env.local`)
* `NEXT_PUBLIC_API_URL` — Application API base endpoint URL

---

## 5. Local Setup & Execution

### Prerequisites
* Node.js v20+ LTS
* npm v10+

### Installation
```bash
# Clone the repository
git clone https://github.com/doczeno/doczeno.git
cd Doczeno

# Install project dependencies
npm install
```

### Running the Application
```bash
# Terminal 1: Start backend API service
npm run dev:backend

# Terminal 2: Start frontend client application
npm run dev:frontend
```

---

## 6. Project Directory Structure

```text
Doczeno/
├── frontend/                     # Client application & public website presentation
│   ├── src/app/                  # Public website routes & admin consoles
│   ├── src/components/           # Clinical UI components, themes, and chatbots
│   ├── src/lib/                  # API client & domain utility helpers
│   └── src/types/                # Shared application domain types
├── backend/                      # Application API service
│   ├── src/config/               # Environment variable validation & configuration
│   ├── src/db/                   # Database connection management
│   ├── src/models/               # Domain data models & query indexes
│   ├── src/middleware/           # Authentication, authorization, and rate limiting
│   ├── src/services/             # Domain business logic & assistant services
│   └── src/routes/               # REST API endpoints
├── .gitignore                    # Environment & secret artifact exclusions
└── package.json                  # Workspace monorepo configuration
```
