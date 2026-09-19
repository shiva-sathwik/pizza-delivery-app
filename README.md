# 🍕 PizzaFlow — Pizza Delivery & Inventory Management Platform

A modern, full-stack web application engineered for pizza ordering, custom pizza crafting, dynamic inventory tracking, and real-time order logistics. Built as an internship project utilizing the MERN stack architecture.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | [React.js](https://react.dev/) + [Vite](https://vitejs.dev/) | High-performance SPA with modern UI components |
| **Backend** | [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/) | RESTful API server, routing, and middleware |
| **Database** | [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) | Document database and Object Data Modeling (ODM) |
| **Security & Utilities** | CORS, Dotenv | Secure cross-origin requests & environment configuration |

---

## 📌 Current Project Status

- **Phase**: **Step 3: Core Foundation Setup (Completed)**
- **Features Implemented in this Step**:
  - Clean modular project structure (`/client` and `/server`)
  - Express.js server with configured CORS, JSON parser, and graceful MongoDB handler
  - Mongoose connection setup with `MONGODB_URI` environment variable
  - Health check endpoint: `GET /api/health`
  - React.js frontend client with live backend heartbeat monitor, latency tracker, and interactive API ping
  - Environment variable templates (`.env.example` in both client and server)
  - Comprehensive `.gitignore` protecting secrets and build artifacts
- **Upcoming Phases (Step 4+)**:
  - User registration, JWT authentication & email verification
  - Pizza catalog & interactive custom pizza builder
  - Order management & Razorpay payment integration
  - Inventory tracking, low-stock threshold alerts (`node-cron`)
  - Admin dashboard with order analytics
  - Real-time order delivery tracking (`Socket.IO`)

---

## 📁 Project Structure

```text
pizza-delivery-app/
├── client/                     # React Frontend (Vite)
│   ├── public/                 # Static assets
│   ├── src/                    # React components and styling
│   │   ├── App.jsx             # Main application component with health check
│   │   ├── index.css           # Modern design system & styling
│   │   └── main.jsx            # React root entrypoint
│   ├── .env.example            # Frontend environment variable template
│   ├── .env                    # Frontend local environment config
│   ├── index.html              # HTML5 entrypoint
│   ├── package.json            # Frontend dependencies and scripts
│   └── vite.config.js          # Vite configuration
├── server/                     # Express Backend (Node.js)
│   ├── config/                 # Configuration files
│   │   └── db.js               # Mongoose MongoDB connection setup
│   ├── controllers/            # Route controllers (prepared for Step 4+)
│   ├── middleware/             # Express middlewares (prepared for Step 4+)
│   ├── models/                 # Mongoose schemas (prepared for Step 4+)
│   ├── routes/                 # API route definitions
│   │   └── health.routes.js    # Health check router (/api/health)
│   ├── services/               # Business logic & services (prepared for Step 4+)
│   ├── utils/                  # Helper utilities (prepared for Step 4+)
│   ├── .env.example            # Backend environment variable template
│   ├── .env                    # Backend local environment config
│   ├── package.json            # Backend dependencies and scripts
│   └── server.js               # Main Express server entrypoint
├── .gitignore                  # Git ignore rules for dependencies & secrets
└── README.md                   # Project documentation
```

---

## ⚙️ Environment Variable Setup

### 1. Server Environment (`server/.env`)
Copy the template and configure your values:
```bash
cp server/.env.example server/.env
```

Default variables:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/pizza-delivery-app
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **Note**: If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string:
> `MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/pizza-delivery-app?retryWrites=true&w=majority`

### 2. Client Environment (`client/.env`)
Copy the template and configure your values:
```bash
cp client/.env.example client/.env
```

Default variables:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🚀 How to Install Dependencies

### Backend Dependencies:
```bash
cd server
npm install
```

Installed packages:
- `express` — Web application framework
- `mongoose` — MongoDB object modeling tool
- `cors` — Cross-Origin Resource Sharing middleware
- `dotenv` — Zero-dependency module that loads environment variables

### Frontend Dependencies:
```bash
cd client
npm install
```

---

## ▶️ How to Start the Application

### 1. Start the Backend Server
From the `server/` directory:
```bash
# Production mode
npm start

# Development mode (with native Node file watcher)
npm run dev
```
The backend will run at: `http://localhost:5000`  
Health check endpoint: `http://localhost:5000/api/health`

### 2. Start the Frontend Client
From the `client/` directory:
```bash
npm run dev
```
The frontend will run at: `http://localhost:5173`

---

## 🔍 Health Check API

### `GET /api/health`
Returns system status and database connectivity.

**Response Example (200 OK):**
```json
{
  "success": true,
  "message": "Pizza Delivery & Inventory Management API is running",
  "status": "online",
  "timestamp": "2026-09-20T00:25:59.547Z",
  "uptime": 401,
  "database": {
    "status": "connected",
    "connected": true
  }
}
```