import gzip
import io
import json
import pandas as pd
from nbtlib import File as NbtFile

def load_advancements(file):
    data = json.load(file)

    rows = []

    for advancement, details in data.items():
        done = details.get("done", False)
        criteria = details.get("criteria", {})

        for crit, timestamp in criteria.items():
            rows.append({
                "advancement": advancement.replace("minecraft:", ""),
                "criterion": crit,
                "timestamp": timestamp,
                "done": done
            })
    
    return pd.DataFrame(rows)

def progression_timeline(df):
    df = df.dropna(subset=["timestamp"])
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values(by="timestamp")

    return df.to_dict(orient="records")

def progression_summary(df):
    total = len(df)
    completed = df[df["done"] == True].shape[0]

    return {
        "total_advancements": total,
        "completed": completed,
        "completion_rate": completed / max(total, 1)
    }

def analyze_progression(file):
    df = load_advancements(file)

    return {
        "summary": progression_summary(df),
        "timeline": progression_timeline(df)
    }


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_inventory(inventory_list):
    rows = []

    for item in inventory_list:
        item_id = str(item.get("id", "unknown"))
        if item_id.startswith("minecraft:"):
            item_id = item_id.replace("minecraft:", "")

        rows.append({
            "item": item_id,
            "count": _safe_int(item.get("Count", 0)),
            "slot": _safe_int(item.get("Slot", -1))
        })

    if not rows:
        return {
            "total_slots_used": 0,
            "stacked_item_count": 0,
            "top_items": []
        }

    inventory_df = pd.DataFrame(rows)
    grouped = (
        inventory_df.groupby("item", as_index=False)["count"]
        .sum()
        .sort_values(by="count", ascending=False)
    )

    return {
        "total_slots_used": len(rows),
        "stacked_item_count": int(inventory_df["count"].sum()),
        "top_items": grouped.head(10).to_dict(orient="records")
    }


def _gamemode_name(gamemode_id):
    gamemode_map = {
        0: "survival",
        1: "creative",
        2: "adventure",
        3: "spectator"
    }

    return gamemode_map.get(gamemode_id, "unknown")


def analyze_player_dat(dat_bytes):
    try:
        payload = gzip.decompress(dat_bytes)
    except OSError:
        payload = dat_bytes

    nbt_data = NbtFile.parse(io.BytesIO(payload))

    if "Data" in nbt_data and "Player" in nbt_data["Data"]:
        player_data = nbt_data["Data"]["Player"]
    else:
        player_data = nbt_data

    pos = player_data.get("Pos", [])
    inventory_list = player_data.get("Inventory", [])
    gamemode_id = _safe_int(player_data.get("playerGameType", -1), -1)

    position = {
        "x": _safe_float(pos[0], 0.0) if len(pos) > 0 else 0.0,
        "y": _safe_float(pos[1], 0.0) if len(pos) > 1 else 0.0,
        "z": _safe_float(pos[2], 0.0) if len(pos) > 2 else 0.0,
    }

    return {
        "dimension": str(player_data.get("Dimension", "unknown")),
        "position": position,
        "health": _safe_float(player_data.get("Health", 0.0), 0.0),
        "food_level": _safe_int(player_data.get("foodLevel", 0), 0),
        "xp_level": _safe_int(player_data.get("XpLevel", 0), 0),
        "xp_total": _safe_int(player_data.get("XpTotal", 0), 0),
        "selected_item_slot": _safe_int(player_data.get("SelectedItemSlot", -1), -1),
        "gamemode": {
            "id": gamemode_id,
            "name": _gamemode_name(gamemode_id)
        },
        "inventory": _parse_inventory(inventory_list)
    }