# Find My Home — Local Setup Guide

This guide will help you run the Find My Home project on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Recommended for easiest setup)
- [Node.js](https://nodejs.org/) (v18+)
- [Go](https://go.dev/dl/) (v1.23+)
- [PostgreSQL](https://www.postgresql.org/download/) (v15+) (If running without Docker)
- [Git](https://git-scm.com/)

---

## Option 1: Quick Start with Docker (Recommended)

The easiest way to run the entire stack (Go Backend, Next.js Web, Next.js Admin, and PostgreSQL DB) is using Docker Compose.

1. **Clone the repository and enter the directory:**
   ```bash
   git clone <repository-url>
   cd findmyhome
   ```

2. **Set up Environment Variables:**
   Copy the example environment file to create your local config.
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and configure your `DB_PASSWORD` and other secrets if necessary.*

3. **Build and Run the Services:**
   ```bash
   docker compose up --build
   ```

4. **Access the Services:**
   - **Go API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
   - **Next.js Web App**: [http://localhost:3000](http://localhost:3000)
   - **Next.js Admin Panel**: [http://localhost:3001](http://localhost:3001)

To stop the services, press `Ctrl+C` in the terminal, or run:
```bash
docker compose down
```

---

## Option 2: Manual Setup (Running Services Individually)

If you prefer to run each service individually without Docker, follow these steps.

### 1. Database Setup
1. Create a PostgreSQL database named `findmyhome`.
2. Apply the schema:
   ```bash
   psql -U postgres -d findmyhome -f schema.sql
   ```

### 2. Go Backend API
1. Navigate to the Go project directory:
   ```bash
   cd findmyhome-go
   ```
2. Export required environment variables (Linux/Mac example):
   ```bash
   export DATABASE_URL="postgres://postgres:your_password@localhost:5432/findmyhome?sslmode=disable"
   export FRONTEND_URL="http://localhost:3000"
   export PUBLIC_API_URL="http://localhost:8000"
   ```
   *(On Windows PowerShell, use `$env:DATABASE_URL="..."` instead of `export`)*
3. Run the Go server:
   ```bash
   go run ./cmd/server
   ```
   *The API will start on port 8000.*

### 3. Web Frontend (Next.js)
1. Open a new terminal and navigate to the web directory:
   ```bash
   cd findmyhome-web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
   *Make sure `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` is set.*
4. Start the development server:
   ```bash
   npm run dev
   ```
   *The web app will be available at [http://localhost:3000](http://localhost:3000).*

### 4. Admin Panel (Next.js)
1. Open a new terminal and navigate to the admin directory:
   ```bash
   cd findmyhome-admin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables: Ensure `.env.local` exists with `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.
4. Start the development server on port 3001:
   ```bash
   npm run dev -- --port 3001
   ```
   *The admin panel will be available at [http://localhost:3001](http://localhost:3001).*

### 5. Mobile App (React Native / Expo)
1. Open a new terminal and navigate to the mobile directory:
   ```bash
   cd findmyhome-mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to set your local IP address (e.g., `EXPO_PUBLIC_API_URL=http://192.168.1.X:8000/api/v1`). Do not use `localhost` for mobile development.*
4. Start the Expo server:
   ```bash
   npx expo start
   ```
   *Scan the QR code with the Expo Go app on your phone, or run `npx expo start --android` to use an emulator.*

---

## Troubleshooting

- **Database Connection Refused**: Ensure PostgreSQL is running and credentials in `DATABASE_URL` (or `.env` for Docker) are correct.
- **Mobile app cannot connect to API**: Ensure you are using your machine's LAN IP address (not `localhost`) in `findmyhome-mobile/.env` and that your phone and computer are on the same Wi-Fi network. Also, verify your firewall is not blocking port 8000.
- **Port already in use**: If port 8000, 3000, or 3001 is taken, stop the conflicting service or configure the apps to use different ports using environment variables.
