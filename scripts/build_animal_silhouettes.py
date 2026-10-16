#!/usr/bin/env python3
"""Draws the generic animal pictures (cow, heifer, calf, bull) into assets/animals/.

The cow is the realistic side-on silhouette of the desk's Livestock mark
(upande_livestock/public/images/livestock_logo.svg, drawn after the reference
icons); the others are that same body, scaled and given the mark of their kind.
Black on transparent: the app tints them with the theme, so one set serves light
and dark. Needs rsvg-convert.   python3 scripts/build_animal_silhouettes.py
"""
import pathlib
import subprocess

BODY = ("M78 72 C140 62 230 66 300 64 C330 63 352 64 370 66 C380 64 388 60 392 56 C396 80 402 110 408 132 "
        "C396 136 388 150 382 166 C376 184 370 198 366 212 L362 316 C362 324 354 328 346 326 L342 230 "
        "C338 220 332 218 326 222 L322 318 C322 326 314 330 306 326 L304 222 C280 230 230 234 180 228 "
        "C166 226 156 230 150 244 C142 262 140 282 142 298 L146 318 C146 326 138 330 130 326 L124 300 "
        "C118 282 114 266 112 248 C106 262 104 282 106 298 L110 318 C110 326 102 330 94 326 L88 298 "
        "C80 270 76 240 70 210 C62 170 60 122 66 92 C68 82 72 76 78 72 Z")
HEAD = ("M392 56 L384 42 L404 52 C410 50 416 52 418 58 C432 76 450 104 462 126 C468 138 462 150 448 150 "
        "C434 150 420 140 408 132 C398 126 388 110 384 92 C382 76 386 64 392 56 Z")
TAIL = "M70 84 C52 122 48 182 52 238 C53 254 56 264 60 272"
SWITCH = "M60 262 C51 271 51 292 60 299 C69 292 69 271 60 262 Z"
HORNS = ("M396 54 C392 36 380 28 366 30 C378 34 386 44 388 58 Z "
         "M410 52 C418 34 432 28 444 32 C432 34 422 44 416 58 Z")
HUMP = "M300 64 C320 30 372 26 392 58 L392 70 L300 70 Z"

# name: (body scale about the ground, head scale about its joint, extras)
KINDS = {
    "cow": (1.0, 1.0, ""),
    "heifer": (0.86, 1.0, ""),
    "calf": (0.58, 1.3, ""),
    "bull": (1.04, 1.0, f'<path d="{HUMP}"/><path d="{HORNS}"/>'),
}

out = pathlib.Path(__file__).resolve().parent.parent / "assets" / "animals"
out.mkdir(parents=True, exist_ok=True)
for name, (k, hk, extra) in KINDS.items():
    # 512 square; the animal stands on y=420 and is centred on x=256.
    tx = 256 - 258 * k
    ty = 420 - 330 * k
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<g fill="#000" transform="translate({tx:.1f} {ty:.1f}) scale({k})">
<path d="{BODY}"/>
<g transform="translate({400 - 400 * hk:.1f} {100 - 100 * hk:.1f}) scale({hk})"><path d="{HEAD}"/></g>
<path d="{TAIL}" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round"/>
<path d="{SWITCH}"/>
{extra}
</g></svg>'''
    src = out / f"{name}.svg"
    src.write_text(svg)
    subprocess.run(["rsvg-convert", "-w", "512", "-h", "512", str(src), "-o", str(out / f"{name}.png")], check=True)
    src.unlink()
print("wrote", sorted(p.name for p in out.glob("*.png")))
