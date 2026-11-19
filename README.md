# 🚀 Ricoz Franchise Management System

A comprehensive, multi-tenant franchise management platform designed to handle operations, sales, marketing, finance, and employee workflows. Built with a modern, scalable architecture using Next.js for the frontend and Express/Node.js for the backend.

---

## 📚 Tech Stack

### Frontend (Client)
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **State Management:** Redux Toolkit
- **Styling:** Tailwind CSS & CSS Modules
- **Icons:** Lucide React
- **Notifications:** Sonner

### Backend (Server)
- **Framework:** Node.js & Express 5
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT (Access & Refresh Tokens), Bcrypt
- **Validation:** Zod
- **File Uploads:** Express Fileupload & GridFS
- **Email:** Nodemailer (SMTP)

---

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Separate Admin and Franchise portals with distinct routing and permissions.
- **Multi-Tenant Architecture:** Admins can scope their view to specific franchises using the `X-Franchise-Id` header.
- **Finance & Billing:** Full invoice generation, payment tracking, Razorpay integration (optional), credit notes, and financial summaries.
- **Sales Pipeline:** Manage leads, track follow-ups, assign owners, and handle accountability tasks.
- **Marketing Hub:** Create campaigns, manage content calendars, and hand off qualified leads to Sales.
- **Secure Authentication:** Robust JWT refresh token rotation with session bounding (max 10 active sessions per user).
- **Data Encryption:** Applicant and sensitive financial data are encrypted at rest using AES-256-GCM.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20.9.0 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas URI)
- [Git](https://git-scm.com/)
- PowerShell (for Windows users)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd ricoz_franchise
2. Server Setup (Backend)
powershell
cd server
npm install
Create a .env file in the server directory (you can copy from .env.example):

env
PORT=10000
MONGO_URI=mongodb://127.0.0.1:27017/ricoz_franchise
CLIENT_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CLIENT_URL=http://localhost:3000

# Authentication Secrets (Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
access_secret=your_64_char_hex_string_here
refresh_secret=your_another_64_char_hex_string_here

# Encryption Key for sensitive data (Must be exactly 64 hex characters)
APPLICATION_DATA_ENCRYPTION_KEY=your_64_char_hex_string_here

# SMTP (Optional - for OTPs and Invites)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Razorpay (Optional - for payment links)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# AI Forecast (Optional)
AI_FORECAST_URL=
AI_FORECAST_API_KEY=
Provision the initial Admin account:
Update the .env file with admin credentials temporarily:

env
ADMIN_NAME=Super Admin
ADMIN_EMAIL=admin@ricoz.local
ADMIN_PASSWORD=AdminPass123!
Run the provision script:

powershell
npm run provision-admin
Start the development server:

powershell
npm run dev
(Server will run on http://localhost:10000)

3. Client Setup (Frontend)
Open a new PowerShell terminal window:

powershell
cd client
npm install
Create a .env.local file in the client directory:

env
NEXT_PUBLIC_API_URL=http://127.0.0.1:10000/api/v1
Start the client:

powershell
npm run dev
(Client will run on http://localhost:3000)

📁 Project Structure
text
ricoz_franchise/
├── client/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/            # App Router pages & layouts
│   │   ├── features/       # Feature-specific UI components (Admin, Finance, Sales, etc.)
│   │   ├── services/       # API Axios clients & types
│   │   ├── redux/          # Global state management
│   │   └── lib/            # Utility functions
│   └── package.json
│
├── server/                 # Express Backend
│   ├── src/
│   │   ├── config/         # DB connection, CORS origins
│   │   ├── middleware/     # Auth, Validation, Error Handling, Rate Limiters
│   │   ├── models/         # Mongoose Schemas (User, Franchise, Finance, Sales, etc.)
│   │   ├── modules/        # Feature-specific controllers & routes
│   │   ├── utils/          # Token generation, Email, Encryption
│   │   └── server.ts       # Entry point
│   └── package.json
│
└── README.md
🔒 Security Highlights
Session Bounding: Users are limited to 10 active refresh tokens. Logging in from an 11th device automatically invalidates the oldest session.

Atomic Transactions: Critical financial operations (like credit notes and payment application) use MongoDB transactions to prevent partial writes.

Payment Guards: The system rejects payments applied to draft or cancelled invoices, and prevents overpayment beyond the outstanding balance.

Zod Validation: Every request body and query parameter is strictly validated before hitting controllers.

📜 Available Scripts
Client (/client)
npm run dev - Starts Next.js in development mode (Turbopack).

npm run build - Builds the app for production.

npm start - Runs the built production app.

npm run lint - Runs ESLint.

Server (/server)
npm run dev - Starts the Express server with tsx watch.

npm run build - Compiles TypeScript to JavaScript (dist/).

npm start - Runs the compiled production server.

npm run provision-admin - Creates the initial admin account.

🌐 API Routes Overview
/api/v1/auth - Login, Register, OTP, Refresh, Logout.

/api/v1/admin - Admin Dashboard, Franchise Management, Employee Directory.

/api/v1/applications - Public Franchise Applications (with document uploads).

/api/v1/finance - Invoices, Payments, Billing Dashboard, Accounting.

/api/v1/sales - Leads, Pipelines, Tasks, Sales Reports.

/api/v1/marketing - Campaigns, Content, Social Drafts, Lead Handoff.

Created with ❤️ for the Ricoz Franchise Network.
