# AWM Agent — Frontend Web Application

The frontend client for the **AWM Agent (AI-Powered Waste Management Platform)**. Built with React 19, TypeScript, and Vite, featuring a role-based design system tailored for Citizens, Municipal Staff, and Sanitation Managers.

---

## 🌟 Key Features

- **Role-Based Portals**:
  - **Citizen Portal**: Report waste with photo uploads, live geolocation tagging, report history tracking, and citizen leaderboard.
  - **Staff Portal**: View assigned collection tasks, update task statuses (In Progress, Completed), record collection notes, and view daily task queues.
  - **Manager Portal**: City-wide oversight dashboard, dynamic heatmaps, fleet/staff management, analytics, and staff approval queue.
- **Authentication & RBAC**:
  - Dual login capabilities: Email/Password & Google OAuth 2.0 (via Supabase Auth).
  - Role-specific login pages (`/login/citizen`, `/login/staff`, `/login/manager`).
  - Account registration with approval workflow for staff/manager roles (`/auth/pending-approval`).
- **Interactive UI**:
  - Smooth glassmorphism styling, responsive layouts, TailwindCSS, and Lucide React iconography.
  - Real-time notification banners and status updates.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **Icons & UI**: [Lucide React](https://lucide.dev/), Tailwind CSS
- **API & Backend Integration**: Axios & Supabase Client SDK (`@supabase/supabase-js`)
- **Maps**: Leaflet / React-Leaflet

---

## 📁 Directory Structure

```text
frontend/
├── public/                 # Static assets (favicons, public images)
├── src/
│   ├── assets/             # Images, logos, and illustration assets
│   ├── components/         # Reusable UI widgets & layout wrappers
│   │   ├── auth/           # Login forms, OAuth buttons, Role Guards
│   │   ├── citizen/        # Citizen report forms, history, leaderboards
│   │   ├── staff/          # Task queue cards, status update modals
│   │   ├── manager/        # Analytics charts, approval management tables
│   │   ├── common/         # Buttons, cards, modals, loaders
│   │   └── layout/         # Header, navigation bars, footer
│   ├── contexts/           # React Context providers (AuthContext, ThemeContext)
│   ├── hooks/              # Custom React hooks (useAuth, useReports, useGeolocation)
│   ├── pages/              # Top-level view routes
│   │   ├── auth/           # LoginPage, RegisterPage, AuthCallbackPage, PendingApprovalPage
│   │   ├── citizen/        # CitizenDashboard
│   │   ├── staff/          # StaffDashboard
│   │   └── manager/        # ManagerDashboard
│   ├── services/           # HTTP clients & Supabase communication
│   │   ├── api.ts          # Axios client configured with backend baseURL
│   │   ├── authService.ts  # Supabase Auth SDK wrapper & token management
│   │   └── reportService.ts# Report creation & task endpoints
│   ├── types/              # TypeScript interfaces and data models
│   ├── utils/              # Formatting helpers, date tools, validators
│   ├── App.tsx             # Root router configuration & route protection
│   ├── index.css           # Global Tailwind and custom styles
│   └── main.tsx            # Vite DOM entry point
├── .env.example            # Sanitized environment template
├── index.html              # HTML shell
├── package.json            # Node dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration & proxies
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Installation

From the `frontend/` directory (or project root):

```bash
cd frontend
npm install
```

### 2. Environment Configuration

Copy the example environment file and populate your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Backend API Endpoint
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

### 3. Development Server

Start the local Vite development server:

```bash
npm run dev
```

The frontend will run at `http://localhost:5173`.

### 4. Production Build

To type-check and generate production build assets:

```bash
npm run build
```

Compiled static files will be placed into the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

---

## 🔐 Authentication & Role Routing

The frontend enforces strict role-based route protection:

1. **OAuth Redirects**: Google OAuth redirects to `/auth/callback`, where the session tokens are extracted, synchronized with `POST /api/v1/auth/google-sync`, and evaluated for role status.
2. **Approval Gateway**: Users awaiting administrative approval are immediately navigated to `/auth/pending-approval`.
3. **Role Guards**: `<ProtectedRoute allowedRoles={['manager']} />` ensures non-managers cannot access executive analytics or staff assignment features.
