# JSON Craft

Local web app for Minecraft save analysis: **FastAPI** backend and **React + Vite + TypeScript** frontend. The UI is a **single page** with one combined import panel: upload **stats**, **advancements**, and **player `.dat`** together; analysis runs only after all three files are selected.

---

## Run locally

**Prerequisites:** Node.js 18+ and npm, Python 3.10+.

### Terminal 1 — backend (from repo root)

```bash
cd backend
python -m venv .venv
```

Activate the venv:

- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **macOS/Linux:** `source .venv/bin/activate`

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Health check: [http://localhost:8000/health](http://localhost:8000/health) → `{ "status": "ok" }`

### Terminal 2 — frontend (from repo root)

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)).

**Optional:** create `frontend/.env` if the API is not on the default host:

```env
VITE_API_URL=http://localhost:8000
```

Upload **stats** `.json`, **advancements** `.json`, and **player** `.dat` through the UI (all three required).

---

## Backend analysis modules

| File                           | Role                                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`main.py`**                  | FastAPI app: CORS, routes (`/health`, `/player`, `/progression`, `/player-name/{uuid}`), multipart uploads, and wiring results from the modules below. Progression requires **both** advancements JSON and player `.dat`.                                                               |
| **`playerAnalysis.py`**        | Reads player **stats** `.json`, builds a tidy table of stat categories (pandas), returns K/D, total mined blocks, **top 5** mined blocks, top killed mobs, and most dangerous mobs.                                                                                                     |
| **`progressionAnalysis.py`**   | Reads **advancements** `.json` into a timeline and summary; milestone-style events; rule-based playstyle scores; parses **player** `.dat` (gzip-aware NBT via `nbtlib`) for position, dimension, gamemode, vitals, inventory, combat-readiness heuristics, and risk-style player state. |
| **`ml_advancement_branch.py`** | ML on advancements: chronological train/test split, logistic regression on hand-built features, confusion matrix and metrics for the API; optional CLI exports a confusion-matrix PNG. See the docs linked below.                                                                       |

---

## Documentation

| Document                                             | Contents                                      |
| ---------------------------------------------------- | --------------------------------------------- |
| [docs/BACKEND_ANALYSIS.md](docs/BACKEND_ANALYSIS.md) | End-to-end explanation of backend processing. |
