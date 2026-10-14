"""Draw the seasonal site icon ("Ako hlavička": the home header in miniature).

Writes public/icons/season/<season>/ with icon.svg, logo.svg and the PNG sizes.
Colours follow LAND in lib/season.ts. PNGs are rendered with headless Chromium
(CHROMIUM env var, default /opt/pw-browsers/chromium) and cropped
with Pillow. Run by hand after a
design change and commit the output; scripts/season-icon.mjs picks the current
season's files before each build.

    python3 scripts/build_icons.py
"""
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image  # pip install pillow

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons" / "season"
CHROMIUM = os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium")

LAND = {
    "jar": dict(sky1="#bfe1f7", sky2="#f2f8ea", far="#8fb0cc", back="#7fbf8e", front="#a6d784", sun="#ffbe2e", scale=1.0),
    "leto": dict(sky1="#9fd2f5", sky2="#fff6dc", far="#86a7c7", back="#5f9f62", front="#c3cf63", sun="#ffb000", scale=1.15),
    "jesen": dict(sky1="#c6dcef", sky2="#fde9cf", far="#8f9fb8", back="#a97a55", front="#e59d4c", sun="#ffbe2e", scale=1.0),
    "zima": dict(sky1="#d3e1ef", sky2="#f6f1ea", far="#9fb3cb", back="#c8d4e3", front="#f4f7fb", sun="#ffd27a", scale=0.9),
}

CAPS = (
    '<path d="M15.3 23.4 L20 18 L24.7 23.4 L22 22.4 L20 24.5 L17.8 22.2Z" fill="#fff"/>'
    '<path d="M39.6 28.8 L44 24 L48.4 28.8 L46 28 L44 29.8 L42 27.8Z" fill="#fff"/>'
)


def sun(cx, cy, r, color, rays):
    out = ""
    if rays:
        for i in range(8):
            a = i * math.pi / 4 + math.pi / 8
            out += (
                f'<line x1="{cx + math.cos(a) * (r + 3):.1f}" y1="{cy + math.sin(a) * (r + 3):.1f}" '
                f'x2="{cx + math.cos(a) * (r + 7):.1f}" y2="{cy + math.sin(a) * (r + 7):.1f}" '
                f'stroke="{color}" stroke-width="2.6" stroke-linecap="round"/>'
            )
    out += f'<circle cx="{cx}" cy="{cy}" r="{r + 4.5:.1f}" fill="#ffd36b" opacity=".4"/>'
    out += f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="{color}"/>'
    return out


def front_hill(season):
    """The season's front hill with its details: flowers, firs, autumn trees or snowy firs."""
    out = f'<path d="M-2 52 Q10 46 22 50 Q34 55 46 49 Q56 45 66 50 L66 64 L-2 64Z" fill="{LAND[season]["front"]}"/>'
    if season == "jesen":
        for x, y, c in [(10, 49, "#d9532c"), (17, 50, "#b8452a"), (51, 48, "#d9532c"), (57, 48.5, "#f0c040")]:
            out += f'<rect x="{x - 0.8}" y="{y}" width="1.6" height="5" fill="#6b4a33"/><circle cx="{x}" cy="{y}" r="3.4" fill="{c}"/>'
    elif season == "zima":
        for x, y in [(9, 50), (15, 51), (52, 49)]:
            out += f'<path d="M{x - 3.5} {y + 3} L{x} {y - 8} L{x + 3.5} {y + 3}Z" fill="#3f6b57"/><path d="M{x - 1.6} {y - 3} L{x} {y - 8} L{x + 1.6} {y - 3}Z" fill="#fff"/>'
    elif season == "leto":
        for x, y in [(10, 50), (16, 51), (53, 48.5)]:
            out += f'<path d="M{x - 3} {y + 3} L{x} {y - 7} L{x + 3} {y + 3}Z" fill="#3f7d42"/>'
    else:
        for x, y, c in [(8, 52, "#fff"), (14, 53, "#f59bc0"), (20, 53.5, "#ffd84d"), (48, 51, "#fff"), (55, 50, "#f59bc0")]:
            out += f'<circle cx="{x}" cy="{y}" r="1.7" fill="{c}"/>'
    return out


def scene(season, uid):
    """The 64 x 64 picture without its frame."""
    L = LAND[season]
    body = (
        f'<defs><linearGradient id="{uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{L["sky1"]}"/>'
        f'<stop offset=".75" stop-color="{L["sky2"]}"/></linearGradient></defs>'
        f'<rect width="64" height="64" fill="url(#{uid}s)"/>'
    )
    body += sun(46, 19, 9 * L["scale"], L["sun"], rays=season == "leto")
    body += f'<path d="M-4 46 L20 18 L44 46Z" fill="{L["far"]}"/><path d="M22 48 L44 24 L68 48Z" fill="{L["far"]}"/>'
    if season in ("zima", "jar"):
        body += CAPS
    body += f'<path d="M-2 46 Q8 38 18 43 Q28 48 38 41 Q50 34 66 42 L66 64 L-2 64Z" fill="{L["back"]}"/>'
    return body + front_hill(season)


def icon_svg(season, rounded=True):
    clip = '<clipPath id="c"><rect width="64" height="64" rx="14"/></clipPath>'
    inner = scene(season, "i")
    if rounded:
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>MounTour</title><defs>{clip}</defs><g clip-path="url(#c)">{inner}</g></svg>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{inner}</svg>'


def logo_svg(season, template):
    """The header logo with the new mark in place of the old one; the wordmark stays as is."""
    t = re.sub(r"<metadata>.*?</metadata>", "", template, flags=re.S)
    mark = f'<g transform="scale(13.4375)"><g clip-path="url(#c)">{scene(season, "l")}</g></g>'
    t = re.sub(r'<g transform="scale\(13\.4375\)"><g clip-path="url\(#c\)">.*?</g></g>', lambda _: mark, t, count=1, flags=re.S)
    return t.replace('<rect width="64" height="64" rx="16"/>', '<rect width="64" height="64" rx="14"/>', 1)


def png(svg, size, path):
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "p.html"
        shot = Path(tmp) / "shot.png"
        sized = svg.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)
        page.write_text(f'<html><body style="margin:0;background:transparent">{sized}</body></html>')
        subprocess.run(
            [CHROMIUM, "--headless", "--no-sandbox", "--hide-scrollbars", "--default-background-color=00000000",
             "--window-size=800,800", f"--screenshot={shot}", page.as_uri()],
            check=True, capture_output=True,
        )
        # Small headless windows draw only part of the page, so shoot big and crop.
        Image.open(shot).crop((0, 0, size, size)).save(path, optimize=True)


def main():
    template = (ROOT / "public" / "brand" / "mountour-logo.svg").read_text()
    for season in LAND:
        d = OUT / season
        d.mkdir(parents=True, exist_ok=True)
        rounded = icon_svg(season)
        (d / "icon.svg").write_text(rounded)
        (d / "logo.svg").write_text(logo_svg(season, template))
        png(rounded, 192, d / "icon-192.png")
        png(rounded, 512, d / "icon-512.png")
        # iPhones round the corners themselves and show transparent corners as black.
        png(icon_svg(season, rounded=False), 180, d / "apple-icon.png")
        print("wrote", d.relative_to(ROOT))


if __name__ == "__main__":
    main()
