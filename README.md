# MC Project

A local web app for Minecraft world save analysis with:

- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TypeScript

It supports three analysis flows:

- **Player analysis** (`.json` stats file)
- **Progression analysis** (`.json` advancements file, optional `.dat` player file)
- **World analysis** (one or more `.mca` region files)

## Quick Start

To run locally:

1. **Frontend only** (required):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

2. Upload your Minecraft data files (stats `.json`, advancements `.json`, or `.mca` region files) through the UI for analysis.

> **Note**: For now, the frontend serves as the interface for file uploads and analysis workflows.

## Repository Structure

- `backend/` — API + analysis code
- `frontend/` — React UI

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (3.13 works) — _optional, for backend development_

## 1) Backend Setup

From repo root:

```bash
cd backend
python -m venv .venv
```

### Activate virtual environment

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Run API server:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

- Open `http://localhost:8000/health`
- Expected response: `{ "status": "ok" }`

## 2) Frontend Setup

In a second terminal, from repo root:

```bash
cd frontend
npm install
```

(Optional) create `.env` in `frontend/` to set API URL explicitly:

```env
VITE_API_URL=http://localhost:8000
```

Start dev server:

```bash
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

## 3) Using the App

### Player Page

- Navigate to **Player Analysis**
- Upload a player stats `.json` file
- Backend endpoint used: `POST /player`

### Progression Page

- Navigate to **Progression**
- Upload:
  - advancements `.json` (required)
  - player `.dat` (optional but supported)
- Backend endpoint used: `POST /progression`
- Response includes parsed `.dat` output under `player_dat` when provided

### World Page

- Navigate to **World Analysis**
- Select a folder containing region `.mca` files
- Backend endpoint used: `POST /world`

## API Endpoints Summary

- `GET /health`
- `POST /player` (multipart form: `file`)
- `POST /progression` (multipart form: `advancements_file`, optional `dat_file`)
- `POST /world` (multipart form: repeated `files`)

## Development Notes

- Backend code entry point: `backend/main.py`
- Frontend routing entry point: `frontend/src/App.tsx`
- API helper used by frontend: `frontend/src/lib/api.ts`
