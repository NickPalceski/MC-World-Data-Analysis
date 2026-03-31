import os
import tempfile


def save_upload_file(upload_file):
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, upload_file.filename)

    with open(file_path, "wb") as f:
        f.write(upload_file.file.read())

    return file_path

def find_stats_file(world_path):
    stats_path = os.path.join(world_path, "stats")

    if not os.path.exists(stats_path):
        return None

    for file in os.listdir(stats_path):
        if file.endswith(".json"):
            return os.path.join(stats_path, file)

    return None

def find_advancement_file(world_path):
    adv_path = os.path.join(world_path, "advancements")

    if not os.path.exists(adv_path):
        return None

    for file in os.listdir(adv_path):
        if file.endswith(".json"):
            return os.path.join(adv_path, file)

    return None

def find_region_files(world_path):
    region_path = os.path.join(world_path, "region")

    if not os.path.exists(region_path):
        return []

    return [
        os.path.join(region_path, f)
        for f in os.listdir(region_path)
        if f.endswith(".mca")
    ]