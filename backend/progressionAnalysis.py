import gzip
import io
import json
import pandas as pd
from nbtlib import File as NbtFile


KEY_EVENT_PATTERNS = {
    "first_diamond": ["story/mine_diamond", "diamonds"],
    "enter_nether": ["story/enter_the_nether", "enter_the_nether"],
    "find_stronghold": ["story/follow_ender_eye", "follow_ender_eye"],
    "enter_end": ["story/enter_the_end", "enter_the_end", "the_end"],
    "defeat_dragon": ["end/kill_dragon", "kill_dragon", "free_the_end"],
    "obtain_elytra": ["end/elytra", "elytra"],
}

MILESTONE_LABELS = {
    "first_diamond": "Find Diamonds",
    "enter_nether": "Reach Nether",
    "find_stronghold": "Find Stronghold",
    "enter_end": "Reach The End",
    "defeat_dragon": "Defeat Ender Dragon",
    "obtain_elytra": "Obtain Elytra",
}

PLAYSTYLE_KEYWORDS = {
    "explorer": [
        "adventure/",
        "nether/",
        "husbandry/complete_catalogue",
        "exploration",
        "discover",
        "biome",
        "travel",
    ],
    "fighter": [
        "kill",
        "combat",
        "sniper",
        "monster",
        "dragon",
        "wither",
        "raid",
    ],
    "builder": [
        "build",
        "construct",
        "story/smelt_iron",
        "story/iron_tools",
        "farmland",
        "husbandry",
    ],
}

def load_advancements(file):
    data = json.load(file)

    rows = []

    for advancement, details in data.items():
        if not isinstance(details, dict):
            continue

        done = details.get("done", False)
        criteria = details.get("criteria", {})

        if not isinstance(criteria, dict):
            continue

        for crit, timestamp in criteria.items():
            rows.append({
                "advancement": advancement.replace("minecraft:", ""),
                "criterion": crit,
                "timestamp": timestamp,
                "done": done
            })
    
    return pd.DataFrame(rows)

def progression_timeline(df):
    df = _normalized_timeline_dataframe(df)

    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

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
    timeline = progression_timeline(df)
    summary = progression_summary(df)

    return {
        "summary": summary,
        "timeline": timeline,
        "insights": build_progression_insights(summary, timeline),
    }


def _normalized_timeline_dataframe(df):
    normalized_df = df.dropna(subset=["timestamp"]).copy()
    normalized_df["timestamp"] = pd.to_datetime(normalized_df["timestamp"], utc=True, errors="coerce")
    normalized_df = normalized_df.dropna(subset=["timestamp"])
    return normalized_df.sort_values(by="timestamp")


def _format_duration(delta):
    total_seconds = int(max(delta.total_seconds(), 0))

    if total_seconds < 3600:
        minutes = max(total_seconds // 60, 1)
        return f"{minutes} minute{'s' if minutes != 1 else ''}"

    if total_seconds < 86400:
        hours = total_seconds / 3600
        rounded_hours = round(hours, 1)
        if rounded_hours.is_integer():
            rounded_hours = int(rounded_hours)
        return f"{rounded_hours} hour{'s' if rounded_hours != 1 else ''}"

    days = total_seconds / 86400
    rounded_days = round(days, 1)
    if rounded_days.is_integer():
        rounded_days = int(rounded_days)
    return f"{rounded_days} day{'s' if rounded_days != 1 else ''}"


def _matches_patterns(advancement_name, patterns):
    lower_name = advancement_name.lower()
    return any(pattern in lower_name for pattern in patterns)


def _find_key_events(event_rows):
    key_events = {}

    for event_name, patterns in KEY_EVENT_PATTERNS.items():
        matches = [
            row for row in event_rows
            if _matches_patterns(str(row.get("advancement", "")), patterns)
        ]
        if not matches:
            continue

        earliest = min(matches, key=lambda row: row["timestamp"])
        key_events[event_name] = earliest

    return key_events


def _playstyle_scores(event_rows, hours_to_complete):
    advancements = [str(row.get("advancement", "")).lower() for row in event_rows]

    explorer_score = sum(
        1 for advancement in advancements
        if any(keyword in advancement for keyword in PLAYSTYLE_KEYWORDS["explorer"])
    )
    fighter_score = sum(
        1 for advancement in advancements
        if any(keyword in advancement for keyword in PLAYSTYLE_KEYWORDS["fighter"])
    )
    builder_score = sum(
        1 for advancement in advancements
        if any(keyword in advancement for keyword in PLAYSTYLE_KEYWORDS["builder"])
    )

    speedrunner_score = 0
    if hours_to_complete <= 4:
        speedrunner_score += 4
    elif hours_to_complete <= 8:
        speedrunner_score += 2

    if hours_to_complete > 48:
        builder_score += 2

    return {
        "explorer": explorer_score,
        "fighter": fighter_score,
        "builder": builder_score,
        "speedrunner": speedrunner_score,
    }


def _playstyle_reasons(style, scores):
    if style == "explorer":
        return "Many travel/biome-oriented advancements unlocked."
    if style == "fighter":
        return "Combat milestones are a strong part of progression."
    if style == "builder":
        return "Slower and steadier progression with fewer combat spikes."
    if style == "speedrunner":
        return "Major progression milestones were completed quickly."

    return f"Scores: {scores}"


def _build_timeline_insights(timeline):
    if not timeline:
        return {
            "total_time": None,
            "advancements_per_hour": 0.0,
            "key_events": {},
            "highlights": [],
            "milestones": [
                {
                    "key": milestone_key,
                    "label": MILESTONE_LABELS[milestone_key],
                    "status": "incomplete",
                    "after_start": None,
                }
                for milestone_key in KEY_EVENT_PATTERNS
            ],
            "playstyle": {
                "classification": "unknown",
                "confidence": 0.0,
                "scores": {},
                "reason": "No timeline events were available.",
            },
        }

    normalized_timeline = []
    for entry in timeline:
        parsed_timestamp = pd.to_datetime(entry.get("timestamp"), utc=True, errors="coerce")
        if pd.isna(parsed_timestamp):
            continue

        normalized_timeline.append({
            "advancement": entry.get("advancement", "unknown"),
            "criterion": entry.get("criterion", "unknown"),
            "done": bool(entry.get("done", False)),
            "timestamp": parsed_timestamp,
        })

    if not normalized_timeline:
        return {
            "total_time": None,
            "advancements_per_hour": 0.0,
            "key_events": {},
            "highlights": [],
            "milestones": [
                {
                    "key": milestone_key,
                    "label": MILESTONE_LABELS[milestone_key],
                    "status": "incomplete",
                    "after_start": None,
                }
                for milestone_key in KEY_EVENT_PATTERNS
            ],
            "playstyle": {
                "classification": "unknown",
                "confidence": 0.0,
                "scores": {},
                "reason": "No valid timestamps were available.",
            },
        }

    normalized_timeline.sort(key=lambda row: row["timestamp"])
    start_time = normalized_timeline[0]["timestamp"]
    end_time = normalized_timeline[-1]["timestamp"]
    total_delta = end_time - start_time
    total_hours = max(total_delta.total_seconds() / 3600, 1 / 3600)

    unlocked_advancements = len({row["advancement"] for row in normalized_timeline})
    advancements_per_hour = round(unlocked_advancements / total_hours, 2)

    key_events = _find_key_events(normalized_timeline)
    key_event_summary = {}
    highlights = []
    milestones = []

    for milestone_key in KEY_EVENT_PATTERNS:
        event_entry = key_events.get(milestone_key)
        if event_entry is None:
            milestones.append({
                "key": milestone_key,
                "label": MILESTONE_LABELS[milestone_key],
                "status": "incomplete",
                "after_start": None,
            })
            continue

        event_delta = event_entry["timestamp"] - start_time
        milestones.append({
            "key": milestone_key,
            "label": MILESTONE_LABELS[milestone_key],
            "status": "complete",
            "after_start": _format_duration(event_delta),
        })

    for event_name, event_entry in key_events.items():
        event_delta = event_entry["timestamp"] - start_time
        key_event_summary[event_name] = {
            "advancement": event_entry["advancement"],
            "timestamp": event_entry["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "after_start": _format_duration(event_delta),
            "hours_after_start": round(event_delta.total_seconds() / 3600, 2),
        }

    if "enter_nether" in key_event_summary:
        highlights.append(f"Reached Nether after {key_event_summary['enter_nether']['after_start']}")
    if "first_diamond" in key_event_summary:
        highlights.append(f"Found diamonds after {key_event_summary['first_diamond']['after_start']}")
    if "defeat_dragon" in key_event_summary:
        highlights.append(f"Took {key_event_summary['defeat_dragon']['after_start']} to defeat Ender Dragon")

    style_scores = _playstyle_scores(normalized_timeline, total_hours)
    dominant_style = max(style_scores, key=style_scores.get) if style_scores else "unknown"
    score_sum = sum(style_scores.values())
    confidence = round(style_scores.get(dominant_style, 0) / score_sum, 2) if score_sum > 0 else 0.0

    return {
        "total_time": _format_duration(total_delta),
        "advancements_per_hour": advancements_per_hour,
        "key_events": key_event_summary,
        "highlights": highlights,
        "milestones": milestones,
        "playstyle": {
            "classification": dominant_style,
            "confidence": confidence,
            "scores": style_scores,
            "reason": _playstyle_reasons(dominant_style, style_scores),
        },
    }


def build_progression_insights(summary, timeline, player_dat=None):
    timeline_insights = _build_timeline_insights(timeline)
    inventory_insights = None
    player_state = None

    if isinstance(player_dat, dict):
        inventory = player_dat.get("inventory")
        if isinstance(inventory, dict):
            inventory_insights = inventory.get("insights")

        player_state = _player_state_insights(player_dat)

    return {
        "timeline": timeline_insights,
        "inventory": inventory_insights,
        "player_state": player_state,
        "totals": {
            "total_advancements": summary.get("total_advancements", 0),
            "completed": summary.get("completed", 0),
            "completion_rate": summary.get("completion_rate", 0),
        },
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

        tag_data = item.get("tag", {})
        enchantments = []
        if isinstance(tag_data, dict):
            raw_enchantments = tag_data.get("Enchantments") or tag_data.get("ench", [])
            if isinstance(raw_enchantments, list):
                enchantments = raw_enchantments

        rows.append({
            "item": item_id,
            "count": _safe_int(item.get("Count", 0)),
            "slot": _safe_int(item.get("Slot", -1)),
            "enchanted": len(enchantments) > 0,
        })

    if not rows:
        empty_insights = _inventory_insights(rows)
        return {
            "total_slots_used": 0,
            "stacked_item_count": 0,
            "top_items": [],
            "insights": empty_insights,
        }

    inventory_df = pd.DataFrame(rows)
    grouped = (
        inventory_df.groupby("item", as_index=False)["count"]
        .sum()
        .sort_values(by="count", ascending=False)
    )

    insight_payload = _inventory_insights(rows)

    return {
        "total_slots_used": len(rows),
        "stacked_item_count": int(inventory_df["count"].sum()),
        "top_items": grouped.head(10).to_dict(orient="records"),
        "insights": insight_payload,
    }


def _inventory_insights(rows):
    if not rows:
        return {
            "most_valuable_item": None,
            "resource_richness": {
                "ores": 0,
                "wood": 0,
                "food": 0,
            },
            "gear_level": "early_game",
            "combat_readiness": {
                "armor_pieces": 0,
                "weapon_tier": "none",
                "enchanted_combat_items": 0,
                "status": "undergeared",
                "insight": "Player is undergeared for high-risk combat.",
            },
        }

    value_map = {
        "enchanted_golden_apple": 1000,
        "nether_star": 900,
        "elytra": 850,
        "netherite_sword": 820,
        "netherite_chestplate": 820,
        "diamond_sword": 700,
        "diamond_chestplate": 700,
        "diamond": 450,
        "emerald": 280,
        "ancient_debris": 500,
    }

    ore_keywords = ["ore", "diamond", "emerald", "ancient_debris", "ingot"]
    wood_keywords = ["log", "planks", "wood", "stick"]
    food_keywords = ["bread", "beef", "pork", "chicken", "apple", "potato", "carrot", "fish"]

    def category_total(keywords):
        return int(sum(row["count"] for row in rows if any(keyword in row["item"] for keyword in keywords)))

    ores_count = category_total(ore_keywords)
    wood_count = category_total(wood_keywords)
    food_count = category_total(food_keywords)

    most_valuable = None
    best_score = -1

    for row in rows:
        base_value = value_map.get(row["item"], 10)
        enchant_bonus = 200 if row.get("enchanted") else 0
        score = base_value + enchant_bonus + (row["count"] * 2)

        if score > best_score:
            best_score = score
            most_valuable = {
                "item": row["item"],
                "count": row["count"],
                "enchanted": bool(row.get("enchanted", False)),
                "score": int(score),
            }

    items = {row["item"] for row in rows}
    if any("netherite" in item or "diamond_" in item for item in items):
        gear_level = "late_game"
    elif any("iron_" in item for item in items):
        gear_level = "mid_game"
    else:
        gear_level = "early_game"

    combat_readiness = _combat_readiness(rows)

    return {
        "most_valuable_item": most_valuable,
        "resource_richness": {
            "ores": ores_count,
            "wood": wood_count,
            "food": food_count,
        },
        "gear_level": gear_level,
        "combat_readiness": combat_readiness,
    }


def _item_tier(item_name):
    if "netherite" in item_name:
        return 4
    if "diamond" in item_name:
        return 3
    if "iron" in item_name:
        return 2
    if "stone" in item_name or "golden" in item_name or "chainmail" in item_name:
        return 1
    return 0


def _tier_name(tier):
    tier_names = {
        0: "none",
        1: "basic",
        2: "iron",
        3: "diamond",
        4: "netherite",
    }
    return tier_names.get(tier, "none")


def _combat_readiness(rows):
    armor_slots = ["helmet", "chestplate", "leggings", "boots"]
    weapon_keywords = ["sword", "axe", "bow", "crossbow", "trident", "mace"]

    armor_rows = [
        row for row in rows
        if any(slot in row["item"] for slot in armor_slots)
    ]
    weapon_rows = [
        row for row in rows
        if any(keyword in row["item"] for keyword in weapon_keywords)
    ]

    armor_piece_types = {
        next((slot for slot in armor_slots if slot in row["item"]), None)
        for row in armor_rows
    }
    armor_piece_count = len({slot for slot in armor_piece_types if slot is not None})

    top_armor_tier = max((_item_tier(row["item"]) for row in armor_rows), default=0)
    top_weapon_tier = max((_item_tier(row["item"]) for row in weapon_rows), default=0)

    enchanted_combat_items = sum(
        1 for row in armor_rows + weapon_rows
        if row.get("enchanted", False)
    )

    if armor_piece_count >= 3 and top_armor_tier >= 3 and top_weapon_tier >= 3 and enchanted_combat_items >= 1:
        status = "endgame_ready"
        insight = "Player is endgame ready."
    elif armor_piece_count >= 2 and top_weapon_tier >= 2:
        status = "prepared"
        insight = "Player has solid combat gear for mid-to-late game fights."
    elif armor_piece_count >= 1 or top_weapon_tier >= 1:
        status = "developing"
        insight = "Player has some combat tools but still has major gear gaps."
    else:
        status = "undergeared"
        insight = "Player is undergeared for high-risk combat."

    return {
        "armor_pieces": armor_piece_count,
        "armor_tier": _tier_name(top_armor_tier),
        "weapon_tier": _tier_name(top_weapon_tier),
        "enchanted_combat_items": enchanted_combat_items,
        "status": status,
        "insight": insight,
    }


def _player_state_insights(player_dat):
    health = _safe_float(player_dat.get("health", 0.0), 0.0)
    hunger = _safe_int(player_dat.get("food_level", 0), 0)
    xp_level = _safe_int(player_dat.get("xp_level", 0), 0)

    risk_score = 0
    if health <= 8:
        risk_score += 2
    elif health <= 14:
        risk_score += 1

    if hunger <= 6:
        risk_score += 2
    elif hunger <= 12:
        risk_score += 1

    if xp_level <= 5:
        risk_score += 1

    if risk_score >= 4:
        classification = "risky"
        insight = "Risky playstyle: low health/hunger state suggests frequent danger exposure."
    elif risk_score >= 2:
        classification = "balanced"
        insight = "Moderate risk profile: survivability is acceptable but not fully stable."
    else:
        classification = "safe"
        insight = "Safe playstyle: current health, hunger, and XP indicate stable conditions."

    return {
        "health": round(health, 1),
        "hunger": hunger,
        "xp_level": xp_level,
        "classification": classification,
        "insight": insight,
    }


def _gamemode_name(gamemode_id):
    gamemode_map = {
        0: "survival",
        1: "creative",
        2: "adventure",
        3: "spectator"
    }

    return gamemode_map.get(gamemode_id, "unknown")


def _normalize_dimension_name(dimension_value):
    dimension_name = str(dimension_value or "unknown")
    if dimension_name.startswith("minecraft:"):
        dimension_name = dimension_name.replace("minecraft:", "", 1)

    alias_map = {
        "the_nether": "nether",
        "the_end": "end",
    }

    return alias_map.get(dimension_name, dimension_name)


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
        "dimension": _normalize_dimension_name(player_data.get("Dimension", "unknown")),
        "position": position,
        "health": _safe_float(player_data.get("Health", 0.0), 0.0),
        "food_level": _safe_int(player_data.get("foodLevel", 0), 0),
        "xp_level": _safe_int(player_data.get("XpLevel", 0), 0),
        "gamemode": {
            "name": _gamemode_name(gamemode_id)
        },
        "inventory": _parse_inventory(inventory_list)
    }