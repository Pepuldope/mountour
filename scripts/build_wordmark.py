"""Builds the Túruj wordmark and logo SVGs in public/brand/ as outlines (no font needed).

Font: Bricolage Grotesque (OFL), default instance (opsz 96, wdth 100, wght 800), the same
cut the brand guide uses. The acute over the "ú" is drawn in sun yellow: the sun accent of
the old wordmark, now part of the name itself.
Run: python3 scripts/build_wordmark.py <BricolageGrotesque variable .woff2/.ttf>
(needs `pip install fonttools brotli`).
"""
import pathlib
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "brand"
INK, INK_ON_DARK, SUN = "#17213A", "#E9EEF7", "#F4A51C"
TEXT = "Túruj"
TRACK = -18  # font units, slightly tight like the old wordmark
PAD = 40  # font units of air around the letters

font = TTFont(sys.argv[1])
if "fvar" in font:
    font = instantiateVariableFont(font, {"opsz": 96, "wdth": 100, "wght": 800})
gs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]
glyf = font["glyf"]


def outline(name, dx, dy=0):
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
    bounds = BoundsPen(gs)
    gs[name].draw(TransformPen(bounds, (1, 0, 0, 1, dx, dy)))
    return pen.getCommands(), bounds.bounds


ink, sun, boxes, x = [], [], [], 0
for ch in TEXT:
    g = cmap[ord(ch)]
    parts = [(c.glyphName, c.x, c.y) for c in glyf[g].components] if glyf[g].isComposite() else [(g, 0, 0)]
    for name, cx, cy in parts:
        d, b = outline(name, x + cx, cy)
        (sun if "comb" in name or name in ("acute",) else ink).append(d)
        if b:
            boxes.append(b)
    x += hmtx[g][0] + TRACK

xmin = min(b[0] for b in boxes) - PAD
ymin = min(b[1] for b in boxes) - PAD
xmax = max(b[2] for b in boxes) + PAD
ymax = max(b[3] for b in boxes) + PAD
W, H = xmax - xmin, ymax - ymin


def mark(fill):
    # Font units are y-up; flip into SVG space with the top-left of the box at 0,0.
    return (f'<g transform="translate({-xmin:.0f},{ymax:.0f}) scale(1,-1)">'
            f'<path fill="{fill}" d="{" ".join(ink)}"/><path fill="{SUN}" d="{" ".join(sun)}"/></g>')


def write(name, body, w, h):
    (OUT / name).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-labelledby="t">'
        f'<title id="t">{TEXT}</title>{body}</svg>\n')


write("turuj-wordmark.svg", mark(INK), W, H)
write("turuj-wordmark-on-dark.svg", mark(INK_ON_DARK), W, H)

# Lockup: the app icon (public/icons/icon.svg) at the wordmark's height, then the name.
icon = (pathlib.Path(__file__).resolve().parent.parent / "public" / "icons" / "icon.svg").read_text()
icon_body = icon[icon.index(">", icon.index("</title>")) + 1: icon.rindex("</svg>")] if "</title>" in icon else ""
s = H / 64
gap = 0.3 * H
for name, fill in (("turuj-logo.svg", INK), ("turuj-logo-on-dark.svg", INK_ON_DARK)):
    write(name, f'<g transform="scale({s:.4f})">{icon_body}</g>'
                f'<g transform="translate({H + gap:.0f},0)">{mark(fill)}</g>', H + gap + W, H)

print(f"wrote {OUT}: wordmark {W:.0f}x{H:.0f}")
