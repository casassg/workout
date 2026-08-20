# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Enrich the plan's exercise YAML from the exercises-dataset (preferred source).

Each curated exercise gets a correct local `demo` GIF ONLY via an explicit,
verified mapping (exact normalized name match, else the CURATED map below).
Fuzzy matching is deliberately NOT used (it produced wrong GIFs). Media (GIF)
files are copied from the dataset into static/exercises/. Old wger `image`
fields are removed.

Curated fields (sets/reps/startingWeight/notes/descriptions) are never
overwritten. `muscle`/`equipment` are only filled when empty.

Usage (invoke through the `terminal` tool, from repo root):
    uv run scripts/sync_exercises.py              # default dataset path
    uv run scripts/sync_exercises.py --dry-run    # preview, don't write
    uv run scripts/sync_exercises.py --data /opt/data/exercises-dataset
"""
import json
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
DATASET_DEFAULT = Path("/opt/data/exercises-dataset")
CATS = ["push", "pull", "legs", "abs"]
STATIC_EX = ROOT / "static" / "exercises"

# Manual map: plan exercise NAME -> dataset record id (verified against the
# dataset 2026-08-20). Only needed when the exact name doesn't match.
CURATED = {
    "Bench Press": "0025",
    "Incline Dumbbell Press": "0314",
    "Cable Fly": "0185",
    "Overhead Press": "0091",
    "Face Pull": "0203",
    "Tricep Pushdown": "0201",
    "Overhead Cable Extension": "0194",
    "Lat Pulldown": "0197",
    "Seated Cable Row": "0861",
    "Single-Arm Cable Row": "0189",
    "Straight-Arm Pulldown": "0238",
    "Barbell Curl": "0031",
    "Incline Dumbbell Curl": "0318",
    "Hammer Curl": "0313",
    "Leg Extension": "0585",
    "Leg Curl": "0586",
    "Standing Calf Raises": "1372",
    "Walking Lunges": "1460",
    "Cable Crunch": "0212",
    "Hanging Leg Raise": "0472",
    "Plank": "0464",
    "Reverse Crunch": "0872",
}


def norm(s):
    return "".join(c for c in (s or "").lower() if c.isalnum() or c == " ").strip()


def load_dataset(path):
    jf = path / "data" / "exercises.json"
    if not jf.exists():
        raise SystemExit(f"exercises.json not found at {jf}")
    with open(jf, encoding="utf-8") as f:
        return json.load(f)


def build_index(ds):
    exact = {}
    by_id = {}
    for e in ds:
        exact.setdefault(norm(e["name"]), e)
        by_id[e["id"]] = e
    return exact, by_id


def resolve(exact, by_id, name):
    """Dataset record for a plan name: CURATED map first, then exact match."""
    if name in CURATED:
        r = by_id.get(CURATED[name])
        if r:
            return r
    return exact.get(norm(name))


def pick_media(rec, ds_root, dry):
    """Copy the dataset gif into static/exercises/. Returns local /exercises/<file> or None."""
    if not rec:
        return None
    gif = rec.get("gif_url")
    if not gif:
        return None
    src = ds_root / gif
    if not src.exists():
        return None
    name = src.name
    if not dry:
        STATIC_EX.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, STATIC_EX / name)
    return "/exercises/" + name


def process(ex, exact, by_id, ds_root, dry):
    rec = resolve(exact, by_id, ex["name"])
    # demo via exact/CURATED only
    demo = pick_media(rec, ds_root, dry) if rec else None
    if demo:
        ex["demo"] = demo
    # remove old wger image
    ex.pop("image", None)
    if rec:
        if not ex.get("muscle"):
            ex["muscle"] = rec.get("target", "").title()
        if not ex.get("equipment"):
            ex["equipment"] = rec.get("equipment", "").title()
    # alternatives: exact/CURATED demo, remove wger image
    for a in ex.get("alternatives", []):
        arec = resolve(exact, by_id, a["name"])
        ademo = pick_media(arec, ds_root, dry) if arec else None
        if ademo:
            a["demo"] = ademo
        a.pop("image", None)
        if arec:
            if not a.get("equipment"):
                a["equipment"] = arec.get("equipment", "").title()
    return ex


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    ds_path = DATASET_DEFAULT
    if "--data" in args:
        ds_path = Path(args[args.index("--data") + 1])
    ds = load_dataset(ds_path)
    exact, by_id = build_index(ds)

    n_demo = 0
    for cat in CATS:
        f = ROOT / "data" / "exercises" / f"{cat}.yaml"
        if not f.exists():
            continue
        data = yaml.safe_load(f.read_text())
        for ex in data.get("exercises", []):
            before = ex.get("demo")
            process(ex, exact, by_id, ds_path, dry)
            if dry:
                print(f"[{cat}] {ex['name']:<26} demo={ex.get('demo') or 'NO'}"
                      + (f"  (was {before})" if before and before != ex.get('demo') else ""))
            if ex.get("demo"):
                n_demo += 1
        if not dry:
            f.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
            print(f"wrote {f}")
    print(f"exercises with demo: {n_demo}")
    print("done")


if __name__ == "__main__":
    main()
