# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Sync exercise GIF demos from hasaneyldrm/exercises-dataset into the workout site.

Usage:
  uv run scripts/sync_exercises.py [--dry-run] [--data <path>]
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
DATASET_REPO = "https://github.com/hasaneyldrm/exercises-dataset"
DATASET_CACHE = Path.home() / ".cache" / "exercises-dataset"
STATIC_EXERCISES = ROOT / "static" / "exercises"

# Maps our YAML exercise name (case-insensitive) -> dataset exercise name.
# Verified against data/exercises.json in hasaneyldrm/exercises-dataset.
CURATED = {
    # Push
    "bench press": "barbell bench press",
    "incline dumbbell press": "dumbbell incline bench press",
    "cable fly": "cable standing up straight crossovers",
    "overhead press": "dumbbell standing overhead press",
    "cable lateral raise": "cable lateral raise",
    "face pull": "cable rear delt row (stirrups)",
    "tricep pushdown": "cable pushdown",
    "overhead cable extension": "cable overhead triceps extension (rope attachment)",
    # Pull
    "lat pulldown": "cable pulldown",
    "seated cable row": "cable seated row",
    "single-arm cable row": "cable one arm bent over row",
    "straight-arm pulldown": "cable straight arm pulldown",
    "barbell curl": "barbell curl",
    "incline dumbbell curl": "dumbbell incline curl",
    "hammer curl": "dumbbell hammer curl",
    # Legs
    "leg extension": "lever leg extension",
    "leg curl": "lever lying leg curl",
    "standing calf raises": "barbell standing calf raise",
    "walking lunges": "dumbbell lunge",
    # Abs
    "cable crunch": "cable kneeling crunch",
    "hanging leg raise": "hanging leg raise",
    "plank": "weighted front plank",
    "cable wood chop": "cable standing lift",
    "reverse crunch": "reverse crunch",
    # Alternatives — push
    "chest press machine": "lever chest press",
    "dumbbell bench press": "dumbbell bench press",
    "dumbbell fly": "dumbbell fly",
    "incline barbell press": "barbell incline bench press",
    "dumbbell shoulder press": "dumbbell one arm shoulder press",
    "dumbbell lateral raise": "dumbbell lateral raise",
    "rear delt fly": "barbell rear delt raise",
    "close-grip bench press": "barbell close-grip bench press",
    "skull crushers": "barbell lying triceps extension skull crusher",
    # Alternatives — pull
    "pull-ups": "pull-up",
    "assisted pull-ups": "assisted pull-up",
    "barbell row": "barbell bent over row",
    "single-arm dumbbell row": "dumbbell bent over row",
    "dumbbell pullover": "dumbbell pullover",
    "ez bar curl": "ez barbell curl",
    "standing dumbbell curl": "dumbbell alternate biceps curl",
    "preacher curl": "barbell preacher curl",
    # Alternatives — legs
    "goblet squat": "dumbbell goblet squat",
    "barbell squat": "barbell full squat",
    "romanian deadlift": "barbell romanian deadlift",
    "reverse lunges": "dumbbell rear lunge",
    "bulgarian split squat": "barbell single leg split squat",
    # Alternatives — abs
    "crunches": "crunch floor",
    "lying leg raise": "lying leg raise flat bench",
    "dead bug": "dead bug",
    "side plank": "side bridge hip abduction",
    "russian twist": "russian twist",
    "mountain climbers": "mountain climber",
    "push-up": "push-up",
    # Functional
    "thruster (dumbbell)": "kettlebell thruster",
    "kettlebell swing": "kettlebell swing",
    "burpee": "burpee",
    "jump squat": "jump squat",
    "renegade row": "kettlebell alternating renegade row",
}


def ensure_dataset(data_path: Path | None) -> Path:
    if data_path:
        return data_path
    if DATASET_CACHE.exists():
        print(f"Updating existing clone at {DATASET_CACHE}...")
        subprocess.run(["git", "pull"], cwd=DATASET_CACHE, check=True)
    else:
        print(f"Shallow-cloning dataset to {DATASET_CACHE}...")
        DATASET_CACHE.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth=1", DATASET_REPO, str(DATASET_CACHE)],
            check=True,
        )
    return DATASET_CACHE


def load_dataset(dataset_path: Path) -> tuple[dict[str, dict], dict[str, Path]]:
    """Returns (name_lower -> entry, dataset_id -> gif_path)."""
    exercises_json = dataset_path / "data" / "exercises.json"
    if not exercises_json.exists():
        sys.exit(f"Dataset exercises.json not found at {exercises_json}")

    entries = json.loads(exercises_json.read_text())
    by_name: dict[str, dict] = {}
    for entry in entries:
        key = entry["name"].lower().strip()
        by_name[key] = entry

    videos_dir = dataset_path / "videos"
    gif_by_id: dict[str, Path] = {}
    if videos_dir.exists():
        for gif in videos_dir.glob("*.gif"):
            # filename: <id>-<hash>.gif
            parts = gif.stem.split("-", 1)
            if len(parts) == 2:
                gif_by_id[parts[0]] = gif

    return by_name, gif_by_id


def find_dataset_entry(name: str, by_name: dict[str, dict]) -> dict | None:
    key = name.lower().strip()
    # Check curated overrides first
    dataset_name = CURATED.get(key)
    if dataset_name:
        entry = by_name.get(dataset_name.lower().strip())
        if entry:
            return entry
    # Exact case-insensitive match
    return by_name.get(key)


def load_yaml_files() -> list[tuple[Path, dict]]:
    results = []
    for f in sorted((ROOT / "data" / "exercises").glob("*.yaml")):
        if f.stem == "running":
            continue
        data = yaml.safe_load(f.read_text())
        results.append((f, data))
    return results


def sync_exercise(
    ex: dict,
    by_name: dict[str, dict],
    gif_by_id: dict[str, Path],
    written_gifs: set[Path],
    dry_run: bool,
    stats: dict,
    context: str,
) -> bool:
    """Mutates ex in place. Returns True if matched."""
    name = ex.get("name", "")
    entry = find_dataset_entry(name, by_name)
    if not entry:
        print(f"  WARNING: no match for {context!r} ({name!r})")
        stats["unmatched"] += 1
        return False

    stats["matched"] += 1
    dataset_id = entry["id"]
    gif_src = gif_by_id.get(dataset_id)
    if not gif_src:
        print(f"  WARNING: no GIF for {name!r} (id={dataset_id})")
        return True

    gif_name = gif_src.name  # e.g. 0042-abc123.gif
    gif_dest = STATIC_EXERCISES / gif_name
    written_gifs.add(gif_dest)

    if not dry_run:
        STATIC_EXERCISES.mkdir(parents=True, exist_ok=True)
        if not gif_dest.exists():
            shutil.copy2(gif_src, gif_dest)
            stats["copied"] += 1
            print(f"  Copied {gif_name} for {name!r}")
        else:
            stats["skipped"] += 1

    ex["demo"] = f"exercises/{gif_name}"
    ex.pop("image", None)

    # Set description from dataset only if not already present
    if not ex.get("description"):
        instructions = entry.get("instructions", {})
        desc = instructions.get("en") if isinstance(instructions, dict) else None
        if desc:
            ex["description"] = desc

    if dry_run:
        print(f"  [dry-run] Would copy {gif_name} for {name!r}")

    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print actions without modifying files")
    parser.add_argument("--data", type=Path, help="Path to existing local clone of the dataset")
    args = parser.parse_args()

    dataset_path = ensure_dataset(args.data)
    by_name, gif_by_id = load_dataset(dataset_path)
    print(f"Loaded {len(by_name)} exercises from dataset, {len(gif_by_id)} GIFs available")

    yaml_files = load_yaml_files()
    written_gifs: set[Path] = set()
    stats = {"matched": 0, "unmatched": 0, "copied": 0, "skipped": 0, "pruned": 0}

    for yaml_path, data in yaml_files:
        print(f"\nProcessing {yaml_path.name}...")
        modified = False
        for ex in (data or {}).get("exercises", []):
            context = f"{yaml_path.stem}/{ex.get('id', '?')}"
            if sync_exercise(ex, by_name, gif_by_id, written_gifs, args.dry_run, stats, context):
                modified = True
            for alt in ex.get("alternatives", []):
                alt_context = f"{context}/alt:{alt.get('id', '?')}"
                sync_exercise(alt, by_name, gif_by_id, written_gifs, args.dry_run, stats, alt_context)

        if modified and not args.dry_run:
            yaml_path.write_text(
                yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False)
            )
            print(f"  Wrote {yaml_path.name}")

    # Prune stale GIFs
    if STATIC_EXERCISES.exists():
        for gif in STATIC_EXERCISES.glob("*.gif"):
            if gif not in written_gifs:
                if args.dry_run:
                    print(f"[dry-run] Would prune stale {gif.name}")
                else:
                    gif.unlink()
                    print(f"Pruned stale {gif.name}")
                stats["pruned"] += 1

    print(f"""
Summary:
  Matched:   {stats['matched']}
  Unmatched: {stats['unmatched']}
  Copied:    {stats['copied']}
  Skipped (already present): {stats['skipped']}
  Pruned:    {stats['pruned']}
""")


if __name__ == "__main__":
    main()
