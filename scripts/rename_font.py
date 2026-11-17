#!/usr/bin/env python3
"""rename_font.py - subset (optional) and rename font families for exact font matching.

Usage:
  python rename_font.py --src fonts/ --prefix "MP " --out instances/
  python rename_font.py --src fonts/NotoSansSC-Regular.ttf --prefix "MP " --out instances/ \
      --text-file chars.txt

What it does:
  1. (optional) subsets each font to the characters in --text-file
  2. renames family records (nameID 1/3/4/6/16/17) by prefixing them
  3. preserves OS/2.usWeightClass and subfamily names
  4. writes <out>/<basename>.<ext>

Requires: fonttools (pip install fonttools).
License note: only modify fonts whose license permits it (OFL fonts are fine;
most commercial fonts are not).
"""
import argparse
import os
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools is required: pip install fonttools")


def sanitize_ps(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in "-_.")


def rename_font(font: TTFont, prefix: str) -> None:
    name_table = font["name"]
    # Collect the current family/subfamily per platform so we only edit family-like records.
    subfamily = None
    for rec in name_table.names:
        if rec.nameID == 2:
            subfamily = rec.toUnicode()
            break
    for rec in name_table.names:
        try:
            value = rec.toUnicode()
        except Exception:
            continue
        if rec.nameID in (1, 16):  # family / typographic family
            rec.string = prefix + value
        elif rec.nameID == 4:      # full name
            rec.string = prefix + value
        elif rec.nameID == 6:      # postscript name (no spaces)
            rec.string = sanitize_ps(prefix + value)
        elif rec.nameID == 3:      # unique id
            rec.string = prefix + value
        # nameID 17 (typographic subfamily) is intentionally left untouched.
    # Never touch weight class: it carries the style.
    if "OS/2" in font:
        _ = font["OS/2"].usWeightClass


def main() -> None:
    ap = argparse.ArgumentParser(description="Subset and rename fonts for exact Figma font matching.")
    ap.add_argument("--src", required=True, help="font file or directory")
    ap.add_argument("--prefix", default="MP ", help="family prefix, e.g. 'MP '")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--text-file", default=None, help="optional characters file for subsetting")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    files = []
    if os.path.isdir(args.src):
        for f in sorted(os.listdir(args.src)):
            if f.lower().endswith((".ttf", ".otf")):
                files.append(os.path.join(args.src, f))
    else:
        files = [args.src]
    if not files:
        sys.exit("no font files found under " + args.src)

    chars = None
    if args.text_file:
        with open(args.text_file, "r", encoding="utf-8") as fh:
            chars = set(fh.read())

    for path in files:
        font = TTFont(path)
        if chars is not None:
            from fontTools import subset
            opts = subset.Options()
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            opts.name_legacy = True
            opts.notdef_outline = True
            subsetter = subset.Subsetter(options=opts)
            subsetter.populate(text="".join(sorted(chars)))
            subsetter.subset(font)
        rename_font(font, args.prefix)
        base = os.path.splitext(os.path.basename(path))[0]
        ext = os.path.splitext(path)[1].lower()
        out_path = os.path.join(args.out, base + ext)
        font.save(out_path)
        print("wrote", out_path)


if __name__ == "__main__":
    main()
