import os
import re
import urllib.error
import urllib.request
import json
from tempfile import NamedTemporaryFile
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from playerAnalysis import analyze_player_stats
from progressionAnalysis import analyze_player_dat, analyze_progression, build_progression_insights
from WorldAnalysis import generate_heatmap

app = FastAPI()

UUID_PATTERN = re.compile(r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
frontend_origins = [origin.strip() for origin in frontend_origin.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/player-name/{uuid}")
async def player_name_lookup(uuid: str):
    if UUID_PATTERN.match(uuid) is None:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    compact_uuid = uuid.replace("-", "").lower()
    profile_endpoints = [
        f"https://sessionserver.mojang.com/session/minecraft/profile/{compact_uuid}",
        f"https://api.mojang.com/user/profile/{compact_uuid}",
    ]

    for endpoint in profile_endpoints:
        try:
            with urllib.request.urlopen(endpoint, timeout=5) as response:
                payload = response.read().decode("utf-8")
                data = json.loads(payload)
                username = data.get("name")

                if isinstance(username, str) and len(username.strip()) > 0:
                    return {"uuid": compact_uuid, "username": username}
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            continue

    return {"uuid": compact_uuid, "username": None}


@app.post("/player")
async def player_analysis(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json player stats file")

    try:
        return analyze_player_stats(file.file)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Player analysis failed: {error}") from error


@app.post("/progression")
async def progression_analysis(
    advancements_file: UploadFile = File(...),
    dat_file: Optional[UploadFile] = File(default=None),
):
    if not advancements_file.filename or not advancements_file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json advancements file")

    if dat_file is not None and (not dat_file.filename or not dat_file.filename.endswith(".dat")):
        raise HTTPException(status_code=400, detail="Optional player data file must be .dat")

    try:
        result = analyze_progression(advancements_file.file)
        if dat_file is not None:
            dat_bytes = await dat_file.read()
            result["player_dat"] = analyze_player_dat(dat_bytes)
            result["dat_file_received"] = dat_file.filename
        else:
            result["player_dat"] = None
            result["dat_file_received"] = None

        result["insights"] = build_progression_insights(
            result.get("summary", {}),
            result.get("timeline", []),
            result.get("player_dat"),
        )
        return result
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Progression analysis failed: {error}") from error


@app.post("/world")
async def world_analysis(files: list[UploadFile] = File(...)):
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one .mca file is required")

    temp_paths: list[str] = []

    try:
        for file in files:
            if not file.filename or not file.filename.endswith(".mca"):
                raise HTTPException(status_code=400, detail="All uploaded files must be .mca")

            with NamedTemporaryFile(delete=False, suffix=".mca") as temp_file:
                temp_file.write(await file.read())
                temp_paths.append(temp_file.name)

        return {"heatmap": generate_heatmap(temp_paths), "files_processed": len(temp_paths)}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"World analysis failed: {error}") from error
    finally:
        for path in temp_paths:
            if os.path.exists(path):
                os.remove(path)
