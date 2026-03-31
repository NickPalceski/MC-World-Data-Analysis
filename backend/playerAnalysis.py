import json
import pandas as pd

def load_player_stats(file):
    data = json.load(file)
    stats = data.get("stats", {})

    rows = []
    for category, values in stats.items():
        for item, count in values.items():
            cleaned_count = int(str(count).replace(",", ""))
            rows.append({
                "category": category.replace("minecraft:", ""),
                "item": item.replace("minecraft:", ""),
                "count": cleaned_count
                })
            
    return pd.DataFrame(rows)

def compute_kd(df):
    kills = df[df["category"] == "killed"]["count"].sum()
    deaths = df[df["category"] == "killed_by"]["count"].sum()
    kd = kills / max(deaths, 1)  # Avoid division by zero

    return {"kills": int(kills), "deaths": int(deaths), "kd_ratio": round(kd, 2)}

def most_mined_blocks(df, top_n=10):
    mined = df[df["category"] == "mined"]
    return mined.sort_values(by="count", ascending=False).head(top_n).to_dict(orient="records")

def most_killed_mobs(df, top_n=5):
    killed = df[df["category"] == "killed"]
    return killed.sort_values(by="count", ascending=False).head(top_n).to_dict(orient="records")

def most_dangerous_mobs(df, top_n=3):
    killed_by = df[df["category"] == "killed_by"]
    return killed_by.sort_values(by="count", ascending=False).head(top_n).to_dict(orient="records")

def total_mined_blocks(df):
    mined = df[df["category"] == "mined"]
    return int(mined["count"].sum())

def analyze_player_stats(file):
    df = load_player_stats(file)

    return {
        "kd": compute_kd(df),
        "total_mined_blocks": total_mined_blocks(df),
        "top_mined_blocks": most_mined_blocks(df),
        "top_killed_mobs": most_killed_mobs(df),
        "top_dangerous_mobs": most_dangerous_mobs(df)
    }