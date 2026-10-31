# Generate PWA icons for Blockjong: deep-jade tile with a 5-pin dot pattern.
# Outputs to frontend/public/: pwa-192.png, pwa-512.png, pwa-maskable-512.png,
# apple-touch-icon.png (180). Run: python scripts/make_icons.py
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public"

JADE = (11, 26, 22, 255)
JADE_EDGE = (18, 56, 46, 255)
IVORY = (243, 232, 208, 255)
IVORY_SHADOW = (216, 203, 177, 255)
INK_GREEN = (15, 59, 49, 255)
RED = (178, 58, 43, 255)


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size: int, maskable: bool, path: Path) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background plate
    rounded(d, (0, 0, size, size), int(size * 0.22), JADE)
    rounded(
        d,
        (int(size * 0.04), int(size * 0.04), int(size * 0.96), int(size * 0.96)),
        int(size * 0.19),
        JADE_EDGE,
    )

    # tile body (smaller safe area for maskable)
    margin = size * (0.24 if maskable else 0.16)
    x0, y0 = margin, margin + size * 0.02
    x1, y1 = size - margin, size - margin + size * 0.06
    rounded(d, (x0 + size * 0.02, y0 + size * 0.03, x1 + size * 0.02, y1 + size * 0.03),
            int(size * 0.09), IVORY_SHADOW)  # drop shadow
    rounded(d, (x0, y0, x1, y1), int(size * 0.09), IVORY)

    # 5-pin pattern: four green corners + red center
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    span_x = (x1 - x0) * 0.26
    span_y = (y1 - y0) * 0.28
    r = size * (0.055 if maskable else 0.065)
    for dx, dy, color in [
        (-span_x, -span_y, INK_GREEN),
        (span_x, -span_y, INK_GREEN),
        (-span_x, span_y, INK_GREEN),
        (span_x, span_y, INK_GREEN),
        (0, 0, RED),
    ]:
        d.ellipse((cx + dx - r, cy + dy - r, cx + dx + r, cy + dy + r), fill=color)

    img.save(path)
    print(f"wrote {path.name} ({size}px, maskable={maskable})")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(512, False, OUT / "pwa-512.png")
    draw_icon(512, True, OUT / "pwa-maskable-512.png")
    draw_icon(192, False, OUT / "pwa-192.png")
    draw_icon(180, False, OUT / "apple-touch-icon.png")
