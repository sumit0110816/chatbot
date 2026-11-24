# NOVA AI — Intelligent AI Chatbot Platform

NOVA AI is a full-stack conversational AI web application powered by Google Gemini, featuring JWT authentication, persistent SQLite conversation history, real-time Server-Sent Events (SSE) streaming, document and image analysis, conversation search, and TXT/PDF export.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Framer Motion (`motion/react`) + Lucide Icons
- **Unified Full-Stack Server**: Express + `node:sqlite` + `@google/genai` (`server.ts`, port `3000`)
- **Python FastAPI Backend**: FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2 + `google-genai` (`backend/`)
- **Database**: SQLite with foreign-key cascading deletes, indexes, and transactional updates

---

## Option 1: Quick Start (Unified Node/Express + Vite on Port 3000)

### Prerequisites
- Node.js 22+ (`node -v`)
- Google Gemini API Key (`GEMINI_API_KEY`)

### Commands (Windows 11 PowerShell / CMD)
```powershell
copy .env.example .env
# Edit .env and set GEMINI_API_KEY="your_api_key"
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Option 2: Running with the Python FastAPI Backend on Windows 11

### 1. Backend Setup (FastAPI + SQLAlchemy + Alembic)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```
Edit `backend\.env` and set:
- `GEMINI_API_KEY=your_gemini_api_key_here`
- `SECRET_KEY=your_long_random_jwt_secret`

Run Alembic database migrations to create all SQLite tables (`users`, `conversations`, `messages`, `user_settings`, `password_reset_tokens`, `revoked_tokens`):
```powershell
alembic upgrade head
```

Start the FastAPI server:
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup (Vite Proxy to FastAPI)
In a second terminal at the project root:
```powershell
npm install
npx vite --port 5173
```
(Or configure `VITE_API_BASE_URL=http://localhost:8000` if running FastAPI on port 8000 separately from `server.ts`.)

---

## API Endpoints

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/demo`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **Conversations**: `GET /api/conversations`, `POST /api/conversations`, `GET /api/conversations/{id}`, `PATCH /api/conversations/{id}`, `DELETE /api/conversations/{id}`, `DELETE /api/conversations`
- **Messages**: `GET /api/conversations/{id}/messages`, `POST /api/conversations/{id}/messages`, `POST /api/conversations/{id}/regenerate`
- **User**: `GET /api/users/profile`, `PATCH /api/users/profile`, `PATCH /api/users/password`, `PATCH /api/users/settings`
