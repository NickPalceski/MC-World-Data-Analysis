# Backend analysis — how it works

---

## Big picture: two requests from the browser

When you run a full analysis from the UI, the frontend sends **two HTTP requests in parallel**:

1. **`POST /player`** — one file: the player **stats** JSON (`stats/<uuid>.json`).
2. **`POST /progression`** — two files: **advancements** JSON (`advancements/<uuid>.json`) and **player data** NBT (`.dat` from `playerdata/<uuid>.dat`).

Both must succeed for the combined dashboard to show everything.

---

## 1. Player stats (`playerAnalysis.py` → `/player`)

### What the file looks like (conceptually)

Minecraft stores stats as a nested JSON object: under `stats` there are **categories** (like `minecraft:mined`, `minecraft:killed`) and under each category many **items** with **counts**.

### What we do

1. **`load_player_stats`** reads the JSON, walks every category and item, strips the `minecraft:` prefix, and normalizes counts (handles string numbers with commas).
2. Everything goes into a **pandas DataFrame** so we can filter and sort easily.

### Derived outputs

- **K/D** — Sum all rows where `category == "killed"` → total kills. Sum where `category == "killed_by"` → deaths. K/D ratio is `kills / max(deaths, 1)` so we never divide by zero.
- **Top mined blocks** — Filter `category == "mined"`, sort by `count` descending, take the **top 5**.
- **Top killed mobs** — Same idea for `killed` (default top 5).
- **Most dangerous mobs** — For `killed_by`, sort by deaths and take the top few (default 3): who kills the player most often.
- **Total mined blocks** — Sum of all `mined` counts (rough “blocks broken” total).

---

## 2. Advancements (`progressionAnalysis.py` → part of `/progression`)

### What the file looks like

Advancements JSON has one entry per advancement id. Each entry can have:

- `done`: completed or not
- `criteria`: a map from **criterion id** → **ISO timestamp** (when that piece was satisfied)

We **explode** that into one row per criterion timestamp:

| advancement      | criterion | timestamp | done |
| ---------------- | --------- | --------- | ---- |
| story/root       | trigger   | 2024-…    | true |
| story/mine_stone | …         | 2024-…    | true |

### Cleaning and timeline

1. Parse timestamps with pandas (`utc=True`), drop bad or missing dates.
2. **Sort by time**

### Summary counts

- **Total rows** in that table (after load) and how many have `done == true`.
- **Completion rate** = completed / total (guards against divide-by-zero).

---

## 3. Milestones and playstyle (still `progressionAnalysis.py`)

These use the **ordered timeline** (parsed back to datetimes inside the helper).

### Milestones (“key events”)

We look for **first occurrence** of certain advancement name patterns — for example diamonds, entering the Nether, finding stronghold, End, dragon, elytra. When found, we record **how long after the first timestamp in the file** that event happened (human-readable strings like “3 hours”, “2 days”).

### Playstyle scores (rule-based, not ML)

We count how many advancement **ids** match rough keyword groups:

- **Explorer** — travel, biomes, adventure paths, etc.
- **Fighter** — combat-related strings.
- **Builder** — crafting, building, husbandry hints.
- **Speedrunner** — bonus if the span from first to last event is very short (heuristic).

The **highest score** becomes the displayed “playstyle,” with a confidence based on share of total score.

---

## 4. Player `.dat` file (`progressionAnalysis.py` → `analyze_player_dat`)

### Format

World saves often gzip-compress the `.dat`. We try **`gzip.decompress` first**; if that fails, we treat the bytes as raw NBT.

We use **`nbtlib`** to parse the NBT tree.

### Finding the player compound

If the file has `Data → Player`, we use that; otherwise we assume the root is the player.

### Fields we extract

- **Position** (`Pos`) → x, y, z
- **Dimension** — normalized (e.g. `the_nether` → `nether`)
- **Health**, **food level**, **XP level**
- **Game type** → survival / creative / adventure / spectator
- **Inventory** — each stack: id, count, slot, whether it has enchantments in NBT

### Inventory pipeline (Backlogged from project MVP due to time constraint)

1. Normalize item ids (strip `minecraft:`).
2. Build a DataFrame, group by item to get **top stacks**.
3. **`_inventory_insights`** applies **hand-tuned rules**:
   - A **value map** scores rare items (e.g. elytra, netherite gear).
   - **Resource richness** counts items whose names look like ores, wood, or food.
   - **Gear level** (early / mid / late) from presence of iron, diamond, netherite gear.
   - **`_combat_readiness`** looks at armor pieces, weapon tiers, enchants → labels like `undergeared`, `prepared`, `endgame_ready`.

### Player state (risk vs safe)

**`_player_state_insights`** uses only **health, hunger, and XP level** from the parsed `.dat`:

- Low health or hunger increases a **risk score**.
- Very low XP adds a little risk.
- Buckets: **SAFE**, **BALANCED**, **RISKY** with short text explanations.

---

## 5. Final progression payload (`build_progression_insights`)

After `analyze_progression` runs, **`main.py`** calls:

```text
build_progression_insights(summary, timeline, player_dat)
```

This merges:

- Timeline-derived insights (milestones, playstyle, pace, highlights).
- Optional **inventory** block from parsed `.dat`.
- **Player state** from `.dat`.
- **Totals** copied from the advancement summary.

So the **single JSON response** from `/progression` includes raw `summary`, `timeline`, `player_dat`, **`insights`**, and the ML block described next.

---

## 6. Advancement branch model (`ml_advancement_branch.py`)

This is a **separate** analysis pass on the **same** advancements JSON. It supports **machine learning** (features, train/test, metrics) and powers the confusion matrix / accuracy section in the UI.

### Problem in one sentence

> At each unlock in time order, knowing **only what unlocked before**, guess the **coarse “branch”** of this unlock (the part before the first `/` in the id, e.g. `story`, `nether`).

### How we build training rows

1. Load advancements → DataFrame (same as elsewhere).
2. Keep valid timestamps, sort chronologically.
3. For unlock index **i = 1 … n−1**:
   - **Label** = branch of the advancement at index `i`.
   - **Features** = statistics of all rows **strictly before** `i`: counts per branch prefix, distinct advancement count, hours since world “start” (first event), hours since previous event.

So one long playthrough becomes **many** labeled examples.

### Rare labels

Branches with very few examples are merged into **`other`** so the classifier stays stable.

### Train / test split

**Chronological:** first 80% of supervised rows → train, last 20% → test.  
Test rows whose label never appeared in training are dropped (and counted).

### Model

**StandardScaler** + **logistic regression** (`lbfgs`, balanced class weights). Multiclass is handled by the default multiclass setting for this solver.

### API output (`advancement_branch_ml_for_api`)

Returns JSON-safe fields: `ok`, `reason` (if not enough data), accuracy, macro precision/recall/F1, per-class table, confusion matrix, and counts (`n_events`, `n_supervised_rows`, train/test sizes, dropped rows).

**No files are written** on the server for this path. The CLI (`python ml_advancement_branch.py …`) can optionally write a confusion-matrix PNG.

### Limitations (important)

- **One world / one player** in typical use — you are not proving generalization to all Minecraft players.
- Events are **correlated** (not independent), so metrics are **illustrative**.
- Good for demonstrating a **pipeline** (pandas → model → evaluation) without extra storage layers, not for production matchmaking.

---

## 7. Other API pieces (`main.py`)

- **`GET /health`** — liveness check.
- **`GET /player-name/{uuid}`** — optional call to Mojang session/API to resolve a username from UUID (used by the frontend for avatars).
- **CORS** — configured for local dev; override with `FRONTEND_ORIGIN` if needed.

---

## File map

| Module                     | Role                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `main.py`                  | Routes, file uploads, wiring progression + ML + insights.                                                                        |
| `playerAnalysis.py`        | Stats JSON → pandas → K/D, mining, mobs.                                                                                         |
| `progressionAnalysis.py`   | Advancements JSON → timeline, summary, milestones, playstyle; `.dat` → NBT → position, vitals, inventory insights, player state. |
| `ml_advancement_branch.py` | Advancement branch classifier + metrics for API and CLI.                                                                         |

---

## Glossary

| Term              | Meaning                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **NBT**           | Named Binary Tag — Minecraft’s nested binary format for saves.                                       |
| **Criterion**     | Sub-step of an advancement; each can unlock at a different time.                                     |
| **Branch**        | First path segment of an advancement id (`nether/foo` → `nether`).                                   |
| **Macro average** | Average of a metric across classes, giving each class equal weight (useful when class sizes differ). |
