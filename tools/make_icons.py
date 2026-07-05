#!/usr/bin/env python3
"""Erzeugt die App-Icons: rot-weiße Kockice (Schachbrett) auf Kalkstein-Grund."""
from PIL import Image, ImageDraw
import os

RED = (216, 52, 44)
WHITE = (255, 255, 255)
PAPER = (246, 247, 245)

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)


def make(size, path, maskable=False):
    img = Image.new('RGB', (size, size), PAPER)
    d = ImageDraw.Draw(img)
    # Schachbrett 5x5, zentriert; bei maskable kleiner (sichere Zone 80%)
    board = int(size * (0.52 if maskable else 0.66))
    cell = board // 5
    board = cell * 5
    x0 = (size - board) // 2
    y0 = (size - board) // 2
    for r in range(5):
        for c in range(5):
            color = RED if (r + c) % 2 == 0 else WHITE
            d.rectangle([x0 + c * cell, y0 + r * cell,
                         x0 + (c + 1) * cell - 1, y0 + (r + 1) * cell - 1],
                        fill=color)
    # feiner Rand um das Brett
    d.rectangle([x0 - 1, y0 - 1, x0 + board, y0 + board],
                outline=(30, 39, 51), width=max(1, size // 170))
    img.save(path, 'PNG')
    print(path)


make(192, os.path.join(OUT, 'icon-192.png'))
make(512, os.path.join(OUT, 'icon-512.png'))
make(512, os.path.join(OUT, 'icon-512-maskable.png'), maskable=True)
