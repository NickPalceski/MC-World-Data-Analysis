import anvil
import numpy as np

def parse_region_file(file_path):
    region = anvil.Region.from_file(file_path)

    explored_chunks = []

    for x in range(32):
        for z in range(32):
            try:
                chunk = region.get_chunk(x, z)
                explored_chunks.append({ "x": x, "z": z })
            except:
                continue
    
    return explored_chunks

def generate_heatmap(region_files):
    heatmap = []

    for file in region_files:
        chunks = parse_region_file(file)
        heatmap.extend(chunks)

    return heatmap

