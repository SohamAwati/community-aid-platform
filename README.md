# Volunteer Connect — Community Aid Platform

> A modern, responsive civic impact web application that connects verified Non-Governmental Organizations (NGOs) with volunteers to coordinate community aid, track civic hours, and deliver real-world social impact.

[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)

---

## 🌟 Key Features

### 🤝 For Volunteers
- **Opportunity Discovery**: Search and filter initiatives across causes (Education, Environment, Healthcare, Animal Welfare, Disaster Relief, Community Outreach).
- **Flexible Filters**: Filter by modality (On-site, Remote, Hybrid), date, required skills, and commitment duration.
- **1-Click Application Flow**: Apply for volunteer roles with capacity checking, deadline enforcement, and status notifications.
- **Civic Impact Dashboard**: Track your hours served, earned skill badges, active initiatives, and upcoming sessions.
- **Automated Impact Certificates**: Receive and download personalized certificates of appreciation for completed volunteer events.
- **Public Volunteer Portfolio**: Share your verified civic accomplishments and badges (`/volunteers/:id`).

### 🏢 For Non-Governmental Organizations (NGOs)
- **Organization Onboarding**: Register your NGO with documentation and verification credentials.
- **Opportunity Management**: Create, edit, and publish volunteer drives with required skills, slots, locations, and volunteer perks.
- **Application Management**: Review volunteer candidates, inspect applicant profiles, and approve or reject applications in real time.
- **Volunteer Tracking**: Monitor active participants and verify completed volunteer hours.
- **Public NGO Organization Showcase**: Showcase your mission, verified status, active drives, and historical impact (`/ngos/:id`).

### 🛡️ For Super Administrators
- **Platform Governance**: Review pending NGO applications, verify legal credentials, or reject fraudulent organizations.
- **Opportunity Moderation**: Review published opportunities and suspend flagged listings.
- **User Management**: Manage volunteer and NGO accounts with role assignments and moderation tools.
- **Platform Analytics**: High-level metrics tracking total volunteers, registered organizations, hours served, and impact trends.

---

## 🔑 Default Super Admin Credentials

For development and evaluation, a pre-configured Super Admin account is available:

- **Email**: `vaishnavinimse8797@gmail.com`
- **Password**: `Nimse@8797`
- **Role**: Super Administrator (`super_admin`)

*(You can also sign up as a new Volunteer or NGO directly through the Sign Up page)*.

---

## 🛠️ Tech Stack & Architecture

- **Frontend Core**: React 19, TypeScript
- **Routing & Bundling**: TanStack Start, Vite 6
- **UI & Styling**: Tailwind CSS, Radix UI Primitives, Lucide Icons, Glassmorphism design system
- **State & Data Layer**: High-Performance Local Persistent Database Engine (`src/lib/local-store`) with SQL-like query builder, joins, and relational mapping
- **Theme**: Seamless Dark/Light mode toggle with system preference support

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or pnpm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SohamAwati/community-aid-platform.git
   cd community-aid-platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8080/
   ```

### Production Build

To build the project for production:

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
├── src/
│   ├── components/         # Reusable UI components (Navbar, Footer, Modals, Cards)
│   ├── hooks/              # Custom React hooks (useAuth, useToast, useTheme)
│   ├── lib/
│   │   ├── local-store/    # In-browser persistent database & query builder
│   │   └── utils.ts        # Helper utilities
│   ├── pages/              # Platform page views
│   │   ├── Index.tsx       # Landing & discovery homepage
│   │   ├── Auth.tsx        # Sign in & registration portal
│   │   ├── Dashboard.tsx   # NGO & Volunteer custom dashboards
│   │   ├── Admin.tsx       # Super Admin control center
│   │   ├── Opportunities.tsx # Full opportunity catalog
│   │   ├── OpportunityDetail.tsx # Deep dive and application page
│   │   ├── Volunteers.tsx  # Volunteer directory
│   │   └── NgoDetail.tsx   # NGO public organization profile
│   └── main.tsx            # Application entry point
├── public/                 # Static assets and icons
├── package.json
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
