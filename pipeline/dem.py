"""Elevation from Copernicus DEM GLO-30 tiles (1x1 degree GeoTIFFs, free incl. commercial use).

Credit: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided
under COPERNICUS by the European Union and ESA.
"""

import math
import sys
import urllib.request
from pathlib import Path

import numpy as np

BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com"


def tile_name(lat_floor, lon_floor):
    ns = "N" if lat_floor >= 0 else "S"
    ew = "E" if lon_floor >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"


def tiles_for(boxes):
    out = set()
    for w, s, e, n in boxes:
        for la in range(math.floor(s), math.floor(n) + 1):
            for lo in range(math.floor(w), math.floor(e) + 1):
                out.add((la, lo))
    return sorted(out)


def download(boxes, dest):
    """Fetch the tiles covering `boxes` into `dest` (skips files already there)."""
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    for la, lo in tiles_for(boxes):
        name = tile_name(la, lo)
        f = dest / f"{name}.tif"
        if f.exists() and f.stat().st_size > 0:
            continue
        print(f"DEM: downloading {name}", file=sys.stderr)
        tmp = f.with_suffix(".part")
        urllib.request.urlretrieve(f"{BUCKET}/{name}/{name}.tif", tmp)
        tmp.rename(f)


class Dem:
    """Bilinear elevation lookup. Points outside the loaded tiles give NaN."""

    def __init__(self, directory):
        self.dir = Path(directory) if directory else None
        self.tiles = {}

    def _tile(self, la, lo):
        key = (la, lo)
        if key not in self.tiles:
            self.tiles[key] = None
            if self.dir:
                f = self.dir / f"{tile_name(la, lo)}.tif"
                if f.exists():
                    import rasterio

                    with rasterio.open(f) as src:
                        self.tiles[key] = (src.read(1).astype(np.float32), src.transform, src.nodata)
        return self.tiles[key]

    @property
    def available(self):
        return bool(self.dir and any(self.dir.glob("*.tif")))

    def sample(self, lats, lons):
        lats = np.asarray(lats, float)
        lons = np.asarray(lons, float)
        out = np.full(len(lats), np.nan)
        la_f = np.floor(lats).astype(int)
        lo_f = np.floor(lons).astype(int)
        for la, lo in set(zip(la_f.tolist(), lo_f.tolist())):
            t = self._tile(la, lo)
            if t is None:
                continue
            arr, tr, nodata = t
            m = (la_f == la) & (lo_f == lo)
            # pixel-centre coordinates
            col = (lons[m] - tr.c) / tr.a - 0.5
            row = (lats[m] - tr.f) / tr.e - 0.5
            c0 = np.clip(np.floor(col).astype(int), 0, arr.shape[1] - 2)
            r0 = np.clip(np.floor(row).astype(int), 0, arr.shape[0] - 2)
            fc = np.clip(col - c0, 0, 1)
            fr = np.clip(row - r0, 0, 1)
            v = (
                arr[r0, c0] * (1 - fc) * (1 - fr)
                + arr[r0, c0 + 1] * fc * (1 - fr)
                + arr[r0 + 1, c0] * (1 - fc) * fr
                + arr[r0 + 1, c0 + 1] * fc * fr
            )
            if nodata is not None:
                v[v == nodata] = np.nan
            out[m] = v
        return out


if __name__ == "__main__":
    import yaml

    cfg = yaml.safe_load(open(Path(__file__).with_name("config.yaml")))
    boxes = [b for r in cfg["regions"] for b in r["bboxes"]]
    download(boxes, sys.argv[1] if len(sys.argv) > 1 else "pipeline/.cache/dem")
