#!/usr/bin/env python3
"""
Seed the dataset with synthetic drawings made from the same geometric shape
model as the frontend rasterizer. For each label we POST `--count` randomized
variations to the backend.

Usage:
    pip install requests pillow
    python scripts/seed_drawings.py                        # 50 per label, all labels
    python scripts/seed_drawings.py --count 30             # 30 per label
    python scripts/seed_drawings.py --labels apple star    # only those labels
    python scripts/seed_drawings.py --api http://localhost:8000/api
"""

from __future__ import annotations

import argparse
import base64
import io
import math
import random
import sys
import uuid
from typing import Callable

import requests
from PIL import Image, ImageDraw


CANVAS = 256          # logical canvas, matches frontend
TARGET = 64           # rasterized PNG size (what the model sees)
SCALE = TARGET / CANVAS

RED = "#f87171"
ORANGE = "#fb923c"
YELLOW = "#fbbf24"
GREEN = "#34d399"
BLUE = "#60a5fa"
PURPLE = "#a78bfa"
PINK = "#f472b6"
GRAY = "#94a3b8"
WHITE = "#ffffff"
DARK = "#0f172a"

NICKS = ["SeedBot", "AutoGen", "SynthA", "SynthB", "SynthC"]


# ---------- Shape factory ----------

def shape_id() -> str:
    return "s-" + uuid.uuid4().hex[:10]


def make(typ: str, **kwargs) -> dict:
    base = {
        "id": shape_id(),
        "type": typ,
        "x": 128.0,
        "y": 128.0,
        "rotation": 0,
        "fill": WHITE,
        "stroke": WHITE,
        "strokeWidth": 2,
        "filled": True,
        "stroked": False,
    }
    base.update(kwargs)
    return base


# ---------- Rasterizer (mirrors web/src/utils/shapes.js drawShape) ----------

def _rotate(x: float, y: float, rad: float) -> tuple[float, float]:
    c, s = math.cos(rad), math.sin(rad)
    return x * c - y * s, x * s + y * c


def _draw_shape(draw: ImageDraw.ImageDraw, shape: dict, scale: float) -> None:
    rad = math.radians(shape.get("rotation", 0) or 0)
    cx = shape["x"] * scale
    cy = shape["y"] * scale
    typ = shape["type"]
    is_line = typ == "line"
    filled = shape.get("filled", True) is not False
    stroked = bool(shape.get("stroked", False)) or is_line
    fill = shape.get("fill") or WHITE
    stroke = shape.get("stroke") or fill
    sw = max(1, int(round(shape.get("strokeWidth", 2) * scale)))

    def _emit_polygon(pts):
        if filled:
            draw.polygon(pts, fill=fill)
        if stroked:
            draw.polygon(pts, outline=stroke)

    if typ == "rect":
        w = shape["width"] * scale
        h = shape["height"] * scale
        local = [(0, 0), (w, 0), (w, h), (0, h)]
        pts = [(cx + _rotate(x, y, rad)[0], cy + _rotate(x, y, rad)[1]) for x, y in local]
        _emit_polygon(pts)

    elif typ == "circle":
        r = shape["radius"] * scale
        bbox = [cx - r, cy - r, cx + r, cy + r]
        if filled:
            draw.ellipse(bbox, fill=fill)
        if stroked:
            draw.ellipse(bbox, outline=stroke)

    elif typ == "ellipse":
        rx = shape["radiusX"] * scale
        ry = shape["radiusY"] * scale
        if abs(rad) < 1e-4:
            bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
            if filled:
                draw.ellipse(bbox, fill=fill)
            if stroked:
                draw.ellipse(bbox, outline=stroke)
        else:
            n = 64
            pts = []
            for i in range(n):
                t = 2 * math.pi * i / n
                rrx, rry = _rotate(rx * math.cos(t), ry * math.sin(t), rad)
                pts.append((cx + rrx, cy + rry))
            _emit_polygon(pts)

    elif typ == "triangle":
        p = shape["points"]
        pts = []
        for i in range(0, len(p), 2):
            rrx, rry = _rotate(p[i] * scale, p[i + 1] * scale, rad)
            pts.append((cx + rrx, cy + rry))
        _emit_polygon(pts)

    elif typ == "line":
        p = shape["points"]
        x1, y1 = _rotate(p[0] * scale, p[1] * scale, rad)
        x2, y2 = _rotate(p[2] * scale, p[3] * scale, rad)
        draw.line([(cx + x1, cy + y1), (cx + x2, cy + y2)], fill=stroke or fill, width=sw)


def rasterize_b64(shapes: list[dict]) -> str:
    img = Image.new("RGB", (TARGET, TARGET), (0, 0, 0))
    drw = ImageDraw.Draw(img)
    for s in shapes:
        _draw_shape(drw, s, SCALE)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------- Per-label generators ----------

def gen_apple(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-12, 12)
    cy = 140 + rng.randint(-10, 10)
    r = rng.randint(48, 64)
    body = rng.choice([RED, "#dc2626", "#ef4444"])
    out = [make("circle", x=cx, y=cy, radius=r, fill=body)]
    # stem
    stem_h = rng.randint(8, 14)
    out.append(make("rect", x=cx - 1, y=cy - r - stem_h, width=3, height=stem_h, fill=GRAY))
    # leaf (rotated ellipse)
    out.append(make("ellipse",
        x=cx + rng.randint(2, 14),
        y=cy - r - rng.randint(0, 4),
        radiusX=rng.randint(14, 22),
        radiusY=rng.randint(7, 12),
        rotation=rng.uniform(-15, 25),
        fill=GREEN))
    return out


def gen_carrot(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-10, 10)
    base_y = 70 + rng.randint(-8, 8)
    apex_y = 220 + rng.randint(-10, 10)
    half_w = rng.randint(20, 32)
    body_color = rng.choice([ORANGE, "#f97316", "#ea580c"])
    out = [make("triangle",
        x=cx, y=base_y,
        points=[-half_w, 0, half_w, 0, 0, apex_y - base_y],
        fill=body_color,
        rotation=rng.uniform(-8, 8))]
    # leaves
    for _ in range(rng.randint(2, 4)):
        size = rng.randint(8, 14)
        out.append(make("triangle",
            x=cx + rng.randint(-12, 12),
            y=base_y + rng.randint(-6, 4),
            points=[-size, 0, size, 0, 0, -int(size * 1.6)],
            fill=GREEN,
            rotation=rng.uniform(-15, 15)))
    return out


def gen_star(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-8, 8)
    cy = 128 + rng.randint(-8, 8)
    size = rng.randint(45, 62)
    color = rng.choice([YELLOW, "#fde047"])
    rot = rng.uniform(-15, 15)
    # Two overlapping equilateral triangles → 6-point star.
    h = int(size * 0.866)  # sqrt(3)/2
    out = [
        make("triangle", x=cx, y=cy,
             points=[0, -size, -h, size // 2, h, size // 2],
             fill=color, rotation=rot),
        make("triangle", x=cx, y=cy,
             points=[0, size, -h, -size // 2, h, -size // 2],
             fill=color, rotation=rot),
    ]
    return out


def gen_house(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-8, 8)
    walls_w = rng.randint(80, 110)
    walls_h = rng.randint(60, 88)
    walls_top = 140 + rng.randint(-10, 10)
    walls_color = rng.choice([WHITE, "#fef3c7", "#fde68a"])
    roof_color = rng.choice([RED, "#dc2626", "#b45309"])

    out = [make("rect",
        x=cx - walls_w / 2, y=walls_top,
        width=walls_w, height=walls_h, fill=walls_color)]
    roof_h = rng.randint(40, 60)
    overhang = rng.randint(0, 12)
    out.append(make("triangle",
        x=cx, y=walls_top,
        points=[-(walls_w / 2 + overhang), 0,
                (walls_w / 2 + overhang), 0,
                0, -roof_h],
        fill=roof_color))
    # door
    door_w = rng.randint(16, 26)
    door_h = rng.randint(28, 40)
    door_x = cx - door_w / 2 + rng.randint(-15, 15)
    out.append(make("rect",
        x=door_x, y=walls_top + walls_h - door_h,
        width=door_w, height=door_h,
        fill=rng.choice([GRAY, "#7c2d12", DARK])))
    # optional window
    if rng.random() < 0.7:
        win_w = rng.randint(12, 20)
        win_h = rng.randint(12, 20)
        wx = cx + rng.choice([-1, 1]) * rng.randint(20, 35)
        wy = walls_top + rng.randint(8, 22)
        out.append(make("rect",
            x=wx - win_w / 2, y=wy,
            width=win_w, height=win_h, fill=BLUE))
    return out


def gen_tree(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-10, 10)
    trunk_w = rng.randint(14, 22)
    trunk_h = rng.randint(50, 80)
    trunk_top = 130 + rng.randint(-10, 10)
    fol_color = rng.choice([GREEN, "#10b981", "#16a34a", "#22c55e"])
    fol_y = trunk_top - rng.randint(8, 22)

    out = [make("rect",
        x=cx - trunk_w / 2, y=trunk_top,
        width=trunk_w, height=trunk_h,
        fill=rng.choice([GRAY, "#92400e", "#7c2d12"]))]
    kind = rng.choice(["circle", "ellipse", "triangle"])
    if kind == "circle":
        r = rng.randint(40, 58)
        out.insert(0, make("circle", x=cx, y=fol_y, radius=r, fill=fol_color))
    elif kind == "ellipse":
        rx = rng.randint(40, 60)
        ry = rng.randint(35, 55)
        out.insert(0, make("ellipse", x=cx, y=fol_y, radiusX=rx, radiusY=ry, fill=fol_color))
    else:
        size = rng.randint(48, 65)
        out.insert(0, make("triangle",
            x=cx, y=fol_y,
            points=[-size, size, size, size, 0, int(-size * 1.2)],
            fill=fol_color))
    return out


def gen_fish(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-15, 15)
    cy = 128 + rng.randint(-12, 12)
    body_rx = rng.randint(45, 65)
    body_ry = rng.randint(20, 32)
    body_color = rng.choice([BLUE, "#06b6d4", "#0ea5e9", "#7dd3fc"])
    direction = rng.choice([-1, 1])

    out = [make("ellipse", x=cx, y=cy, radiusX=body_rx, radiusY=body_ry, fill=body_color)]
    # tail (triangle butting against the body)
    tail = rng.randint(20, 32)
    tail_x = cx - direction * body_rx
    out.append(make("triangle",
        x=tail_x, y=cy,
        points=[0, 0,
                -direction * tail, -int(tail * 0.7),
                -direction * tail, int(tail * 0.7)],
        fill=body_color))
    # eye
    out.append(make("circle",
        x=cx + direction * body_rx * 0.55,
        y=cy - body_ry * 0.25,
        radius=rng.randint(3, 5),
        fill=DARK))
    return out


def gen_sun(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-8, 8)
    cy = 128 + rng.randint(-8, 8)
    r = rng.randint(28, 40)
    color = rng.choice([YELLOW, "#fde047", ORANGE])
    out = [make("circle", x=cx, y=cy, radius=r, fill=color)]
    n = rng.choice([6, 8, 10, 12])
    ray_len = rng.randint(20, 40)
    ray_thick = rng.randint(3, 6)
    for i in range(n):
        angle = 2 * math.pi * (i + rng.uniform(-0.05, 0.05)) / n
        x1 = math.cos(angle) * (r + 4)
        y1 = math.sin(angle) * (r + 4)
        x2 = math.cos(angle) * (r + ray_len)
        y2 = math.sin(angle) * (r + ray_len)
        out.append(make("line",
            x=cx, y=cy,
            points=[x1, y1, x2, y2],
            fill=color, stroke=color,
            filled=False, stroked=True,
            strokeWidth=ray_thick))
    return out


def gen_flower(rng: random.Random) -> list[dict]:
    cx = 128 + rng.randint(-8, 8)
    cy = 128 + rng.randint(-8, 8)
    petal_color = rng.choice([PINK, RED, PURPLE, "#fb7185", YELLOW])
    n_petals = rng.choice([5, 6, 8])
    dist = rng.randint(20, 30)
    rx = rng.randint(12, 20)
    ry = rng.randint(20, 30)

    out = []
    for i in range(n_petals):
        angle = 2 * math.pi * i / n_petals
        out.append(make("ellipse",
            x=cx + math.cos(angle) * dist,
            y=cy + math.sin(angle) * dist,
            radiusX=rx, radiusY=ry,
            rotation=math.degrees(angle) + 90,
            fill=petal_color))
    out.append(make("circle",
        x=cx, y=cy, radius=rng.randint(8, 14),
        fill=YELLOW))
    return out


GENERATORS: dict[str, Callable[[random.Random], list[dict]]] = {
    "apple": gen_apple,
    "carrot": gen_carrot,
    "star": gen_star,
    "house": gen_house,
    "tree": gen_tree,
    "fish": gen_fish,
    "sun": gen_sun,
    "flower": gen_flower,
}


# ---------- Main ----------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8000/api",
                        help="Backend API base URL")
    parser.add_argument("--count", type=int, default=50,
                        help="Number of drawings per label")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--labels", nargs="*", default=None,
                        help="Labels to seed (default: all 8)")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    labels = args.labels or list(GENERATORS.keys())

    sess = requests.Session()
    total = 0
    for label in labels:
        gen = GENERATORS.get(label)
        if gen is None:
            print(f"  Skipping unknown label: {label}")
            continue
        print(f"\n=== {label} ===")
        for i in range(args.count):
            shapes = gen(rng)
            payload = {
                "label": label,
                "nickname": rng.choice(NICKS),
                "shapes": shapes,
                "png_base64": rasterize_b64(shapes),
            }
            try:
                r = sess.post(f"{args.api}/drawings", json=payload, timeout=15)
                r.raise_for_status()
                total += 1
            except requests.RequestException as e:
                print(f"  Error on {label} #{i + 1}: {e}")
                return 1
            if (i + 1) % 10 == 0 or i + 1 == args.count:
                print(f"  {i + 1}/{args.count} ✓")

    print(f"\nSeeded {total} drawings total.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
