#!/usr/bin/env python3
"""Rebuild full-page assets from the two user-provided first-edition PDFs.
Requires PyMuPDF and Pillow. It preserves pages, not solved exercise keys.
Already-rendered assets are supplied, so ordinary builds do not need the PDFs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STARTS = [4, 16, 30, 42, 56, 68, 82, 94, 108, 120]

def page_meta(number: int) -> tuple[int | None, str, int | None]:
    unit = None
    section = 'Справочная страница'
    printed = None
    if 5 <= number <= 144:
        printed = number - 1
        for u, start in enumerate(STARTS, 1):
            if start <= printed <= start + 11:
                unit = u
                offset = printed - start
                labels = ['A · Reading & vocabulary', 'B · Grammar & listening',
                          'C · Listening & speaking', 'D · Culture & grammar',
                          'E · Writing', 'Vocabulary insight', 'Review']
                section = labels[offset // 2 if offset < 10 else offset - 5]
        if 135 <= number <= 144:
            unit, section = number - 134, 'Vocabulary bank'
        if printed in [28, 29, 54, 55, 80, 81, 106, 107, 132, 133]:
            start = printed if printed % 2 == 0 else printed - 1
            unit = ([28, 54, 80, 106, 132].index(start) + 1) * 2
            section = 'Cumulative review'
    elif 146 <= number <= 165:
        unit, section, printed = (number - 146) // 2 + 1, 'Grammar reference & practice', number - 42
    elif number in [1, 2, 166]:
        section = 'Обложка / титул'
    elif number in [3, 4]:
        section = 'Содержание'
    elif number == 145:
        section = 'Издательские сведения'
    return unit, section, printed

def valid_image(path: Path, width: int) -> bool:
    try:
        with Image.open(path) as im:
            im.load()
            return im.width >= width - 1
    except (OSError, ValueError):
        return False

def render(path: Path, bid: str, title: str, level: str, width: int, force: bool) -> dict:
    if not path.is_file():
        raise FileNotFoundError(path)
    target = ROOT / 'web' / 'books' / bid
    target.mkdir(parents=True, exist_ok=True)
    pages = []
    with fitz.open(path) as document:
        if len(document) != 166:
            raise ValueError(f'{title}: expected the supplied 166-page edition; got {len(document)}. Review page mapping first.')
        for i, page in enumerate(document):
            number = i + 1
            image = target / f'{number:03}.webp'
            if force or not valid_image(image, width):
                scale = width / page.rect.width
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                temp = image.with_suffix('.webp.tmp')
                Image.frombytes('RGB', (pix.width, pix.height), pix.samples).save(temp, 'WEBP', quality=80, method=4)
                if not valid_image(temp, width):
                    temp.unlink(missing_ok=True)
                    raise RuntimeError(f'Image validation failed: {image.name}')
                os.replace(temp, image)
            unit, section, printed = page_meta(number)
            pages.append(dict(number=number, printed=printed, unit=unit, section=section,
                              image=f'books/{bid}/{number:03}.webp', text=page.get_text('text')))
            if number % 30 == 0:
                print(title, number, flush=True)
    return dict(id=bid, title=title, levelRange=level, pageCount=len(pages), pages=pages,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), audioIncluded=False)

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pre', required=True, type=Path)
    parser.add_argument('--intermediate', required=True, type=Path)
    parser.add_argument('--width', type=int, default=1500)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    if not 1000 <= args.width <= 3000:
        parser.error('--width must be between 1000 and 3000')
    manifest = [render(args.pre, 'pre', 'Insight Pre-Intermediate', 'A2 → B1', args.width, args.force),
                render(args.intermediate, 'int', 'Insight Intermediate', 'B1 → B2', args.width, args.force)]
    web = ROOT / 'web'
    (web / 'books/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf-8')
    (web / 'book-pages.js').write_text('window.BOOK_PAGES=' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print('332 pages rendered and validated. Rebuild content with tools/build-books.py and tools/build-book-tasks.py.')

if __name__ == '__main__':
    main()
