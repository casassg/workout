# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Enrich the plan's exercise YAML from the exercises-dataset (preferred source).

Reads data/exercises/{push,pull,legs,abs}.yaml (the curated plan: name,
sets, reps, startingWeight, notes, descriptions) and enriches each exercise
and alternative with data from hasaneyldrm/exercises-dataset:

  - muscle      <- dataset `target` (if the curated field is empty)
  - equipment   <- dataset `equipment` (if the curated field is empty)
  - demo        <- local media reference (gif) copied into /static
  - alternatives: auto-add up to N extra alternatives from the same dataset
    `target`, so each exercise has enough swaps. Curated alternatives are
    kept (and matched to their own dataset record for demo/muscle).

The plan (sets/reps/weights/notes/curated descriptions) is NEVER overwritten.
Media (gif) files referenced are copied from the dataset into static/exercises/.

Usage (invoke through the `terminal` tool, from repo root):
    uv run scripts/sync_exercises.py                # use default dataset path
    uv run scripts/sync_exercises.py --data /opt/data/exercises-dataset
    uv run scripts/sync_exercises.py --dry-run      # don't write files
"""
import json
import re
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
DATASET_DEFAULT = Path("/opt/data/exercises-dataset")
CATS = ["push", "pull", "legs", "abs"]
STATIC_EX = ROOT / "static" / "exercises"
DEFAULT_ALTS = 3  # total alternatives to keep per exercise (curated + auto)


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", (s or "").lower()).strip()


def load_dataset(path):
    jf = path / "data" / "exercises.json"
    if not jf.exists():
        raise SystemExit(f"exercises.json not found at {jf}")
    with open(jf, encoding="utf-8") as f:
        return json.load(f)


def index_by_name(ds):
    idx = {}
    for ex in ds:
        key = norm(ex["name"])
        idx.setdefault(key, ex)
        # also allow full-name lookup for sub-phrases later
        idx.setdefault("full:" + key, ex)
    return idx


def find(idx, name):
    """Exact first, then normalized-contains against the raw dataset list."""
    key = norm(name)
    if not key:
        return None
    if key in idx:
        return idx[key]
    # fuzzy: the curated name may differ slightly from dataset name
    for k, ex in idx.items():
        if k.startswith("full:"):
            continue
        if key in (" " + k) or k in (" " + key):
            return ex
    return None


def pick_media(ex, idx, ds_root, out_dir, dry=False):
    """Copy the dataset gif for this record into static/exercises/. Returns local path (/exercises/<name>.gif)."""
    rec = find(idx, ex.get("name"))
    if not rec:
        return None
    gif = rec.get("gif_url")
    if not gif:
        return None
    gif_src = ds_root / gif
    if not gif_src.exists():
        return None
    gif_name = gif_src.name
    gif_dst = out_dir / gif_name
    if not dry:
        shutil.copyfile(gif_src, gif_dst)
    return "/exercises/" + gif_name


def enrich_exercise(ds, idx, ex, target_refs, ds_root, out_dir, seen_ids, dry=False):
    rec = find(idx, ex["name"])
    if rec:
        if not ex.get("muscle"):
            ex["muscle"] = rec.get("target", "").title()
        if not ex.get("equipment"):
            ex["equipment"] = rec.get("equipment", "").title()
    ex["demo"] = pick_media(ex, idx, ds_root, out_dir, dry) or ex.get("demo")
    # normalize alternatives
    alts = ex.get("alternatives", [])
    alt_ids = {norm(a.get("name")) for a in alts}
    for a in alts:
        arec = find(idx, a.get("name"))
        if arec:
            if not a.get("equipment"):
                a["equipment"] = arec.get("equipment", "").title()
            a["demo"] = pick_media(a, idx, ds_root, out_dir, dry) or a.get("demo")
    # auto-add alternatives that share a name token AND match target/equipment
    if rec and len(alts) < DEFAULT_ALTS:
        target = norm(rec.get("target"))
        ex_norm = norm(ex["name"])
        ex_tokens = set(ex_norm.split())
        for cand in ds:
            if len(alts) >= DEFAULT_ALTS:
                break
            if norm(cand.get("target")) != target:
                continue
            cn = norm(cand.get("name"))
            if cn == ex_norm or cn in alt_ids:
                continue
            if cn in seen_ids:
                continue
            c_tokens = set(cn.split())
            # must share at least one meaningful token with the exercise name
            shared = ex_tokens & c_tokens
            if not shared:
                continue
            alts.append({
                "id": "auto_" + cand.get("id", cn),
                "name": cand.get("name"),
                "equipment": (cand.get("equipment") or "").title(),
                "demo": pick_media({"name": cand["name"]}, idx, ds_root, out_dir, dry),
            })
            alt_ids.add(cn)
            seen_ids.add(cn)
    if alts:
        ex["alternatives"] = alts
    return ex


def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    data_path = None
    if "--data" in args:
        data_path = Path(args[args.index("--data") + 1])
    ds_path = (data_path or DATASET_DEFAULT)
    ds = load_dataset(ds_path)
    idx = index_by_name(ds)

    STATIC_EX.mkdir(parents=True, exist_ok=True)

    plan = {}
    for cat in CATS:
        f = ROOT / "data" / "exercises" / f"{cat}.yaml"
        if not f.exists():
            continue
        data = yaml.safe_load(f.read_text())
        seen = set()
        for ex in data.get("exercises", []):
            before_alts = len(ex.get("alternatives", []))
            enrich_exercise(ds, idx, ex, None, ds_path, STATIC_EX, seen, dry)
            after_alts = len(ex.get("alternatives", []))
            if dry:
                added = "+".join(a["name"] for a in (ex.get("alternatives") or [])[before_alts:])
                print(f"[{cat}] {ex['name']:<28} "
                      f"demo={ex.get('demo') or 'NO'} "
                      f"muscle={ex.get('muscle') or '-'} "
                      f"alts {before_alts}->{after_alts}"
                      + (f"  +{added}" if added else ""))
        plan[cat] = data

    for cat, data in plan.items():
        f = ROOT / "data" / "exercises" / f"{cat}.yaml"
        if dry:
            print(f"[dry-run] would write {f}")
            continue
        f.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
        print(f"wrote {f}")

    copied = list(STATIC_EX.glob("*")) if STATIC_EX.exists() else []
    if not dry:
        print(f"media files in static/exercises: {len(copied)}")
    print("done")


if __name__ == "__main__":
    main()
