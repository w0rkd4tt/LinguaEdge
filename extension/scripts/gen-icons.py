#!/usr/bin/env python3
"""Generate brand PNG icons for LinguaEdge using only the stdlib.

Renders a rounded square in brand-blue with a white "L" letter at the centre,
emitted at 16/32/48/128 px. The output is a hand-rolled PNG (no Pillow needed).
"""
import os
import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BRAND = (47, 123, 255)        # brand-500 #2f7bff
BRAND_DARK = (26, 92, 240)    # brand-600 #1a5cf0
WHITE = (255, 255, 255)

SIZES = [16, 32, 48, 128]


def make_canvas(w: int, h: int):
    return bytearray([0, 0, 0, 0]) * (w * h)


def put_pixel(buf: bytearray, w: int, x: int, y: int, rgba):
    if x < 0 or y < 0 or x >= w:
        return
    i = (y * w + x) * 4
    if i + 3 >= len(buf):
        return
    buf[i] = rgba[0]
    buf[i + 1] = rgba[1]
    buf[i + 2] = rgba[2]
    buf[i + 3] = rgba[3]


def blend(src, dst):
    sa = src[3] / 255.0
    if sa == 0:
        return dst
    da = dst[3] / 255.0
    out_a = sa + da * (1 - sa)
    if out_a == 0:
        return (0, 0, 0, 0)
    out_r = (src[0] * sa + dst[0] * da * (1 - sa)) / out_a
    out_g = (src[1] * sa + dst[1] * da * (1 - sa)) / out_a
    out_b = (src[2] * sa + dst[2] * da * (1 - sa)) / out_a
    return (int(out_r), int(out_g), int(out_b), int(out_a * 255))


def get_pixel(buf, w, x, y):
    i = (y * w + x) * 4
    return (buf[i], buf[i + 1], buf[i + 2], buf[i + 3])


def fill_rounded_rect(buf, w, h, x0, y0, x1, y1, radius, color):
    for y in range(y0, y1):
        for x in range(x0, x1):
            # rounded corner test using nearest-corner distance
            cx = x
            cy = y
            if x < x0 + radius and y < y0 + radius:
                cx, cy = x0 + radius, y0 + radius
            elif x >= x1 - radius and y < y0 + radius:
                cx, cy = x1 - 1 - radius, y0 + radius
            elif x < x0 + radius and y >= y1 - radius:
                cx, cy = x0 + radius, y1 - 1 - radius
            elif x >= x1 - radius and y >= y1 - radius:
                cx, cy = x1 - 1 - radius, y1 - 1 - radius
            else:
                put_pixel(buf, w, x, y, (*color, 255))
                continue
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d <= radius - 0.5:
                put_pixel(buf, w, x, y, (*color, 255))
            elif d <= radius + 0.5:
                # antialias edge
                alpha = max(0, min(1, radius + 0.5 - d))
                src = (*color, int(alpha * 255))
                dst = get_pixel(buf, w, x, y)
                put_pixel(buf, w, x, y, blend(src, dst))


def draw_letter_L(buf, w, h, color, size):
    # Render an "L" by stroking two rectangles, sized to the icon.
    margin = max(2, int(size * 0.22))
    stroke = max(2, int(size * 0.14))
    top = margin
    bottom = size - margin
    left = margin + 1
    # vertical stroke
    for y in range(top, bottom):
        for x in range(left, left + stroke):
            put_pixel(buf, w, x, y, (*color, 255))
    # bottom stroke
    bot_w = max(stroke + 2, int(size * 0.42))
    for y in range(bottom - stroke, bottom):
        for x in range(left, left + bot_w):
            put_pixel(buf, w, x, y, (*color, 255))


def buffer_to_png(buf: bytes, width: int, height: int) -> bytes:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter byte
        raw.extend(buf[y * stride:(y + 1) * stride])
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def render(size: int) -> bytes:
    w = h = size
    buf = make_canvas(w, h)
    radius = max(2, int(size * 0.22))
    fill_rounded_rect(buf, w, h, 0, 0, w, h, radius, BRAND)
    draw_letter_L(buf, w, h, WHITE, size)
    return buffer_to_png(bytes(buf), w, h)


def main():
    for s in SIZES:
        png = render(s)
        path = OUT_DIR / f"icon-{s}.png"
        path.write_bytes(png)
        print(f"wrote {path} ({len(png)} bytes)")


if __name__ == "__main__":
    main()
