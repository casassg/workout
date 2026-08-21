# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Validate data/schedule.yaml and data/exercises/*.yaml. Run: uv run scripts/validate.py"""
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_TYPES = {"gym", "run", "rest", "flexible"}
errors = []


def err(msg):
    errors.append(msg)


def check_demo(demo, where):
    if demo and not (ROOT / "static" / demo).exists():
        err(f"{where}: demo {demo!r} not found under static/exercises/")


def check_exercise(ex, where):
    for field in ("id", "name", "sets", "reps"):
        if field not in ex:
            err(f"{where}: missing required field {field!r}")
    check_demo(ex.get("demo"), where)
    for alt in ex.get("alternatives", []):
        for field in ("id", "name"):
            if field not in alt:
                err(f"{where} alternative: missing {field!r}")
        check_demo(alt.get("demo"), f"{where} alt {alt.get('id', '?')}")


# Load exercise data
categories = {}  # name -> data
for f in sorted((ROOT / "data" / "exercises").glob("*.yaml")):
    try:
        categories[f.stem] = yaml.safe_load(f.read_text())
    except yaml.YAMLError as e:
        err(f"{f}: invalid YAML: {e}")

gym_categories = {k for k, v in categories.items() if "exercises" in (v or {})}
run_ids = {w.get("id") for w in (categories.get("running") or {}).get("workouts", [])}

for name, cat in categories.items():
    if name == "running":
        for w in (cat or {}).get("workouts", []):
            for field in ("id", "name", "type", "duration", "intensity"):
                if field not in w:
                    err(f"running workout {w.get('id', '?')}: missing {field!r}")
        continue
    for ex in (cat or {}).get("exercises", []):
        check_exercise(ex, f"{name}/{ex.get('id', '?')}")


def check_workout_ref(block, where):
    t = block.get("type")
    ref = block.get("workout")
    if t == "gym" and ref not in gym_categories:
        err(f"{where}: workout {ref!r} is not an exercise category ({sorted(gym_categories)})")
    if t == "run" and ref not in run_ids:
        err(f"{where}: workout {ref!r} is not a running workout id ({sorted(run_ids)})")


# Load schedule
try:
    schedule = yaml.safe_load((ROOT / "data" / "schedule.yaml").read_text())
except yaml.YAMLError as e:
    sys.exit(f"data/schedule.yaml: invalid YAML: {e}")

week = (schedule or {}).get("week", {})
for day in DAYS:
    block = week.get(day)
    if not block:
        err(f"schedule: missing day {day!r}")
        continue
    if block.get("type") not in DAY_TYPES:
        err(f"schedule {day}: type must be one of {sorted(DAY_TYPES)}, got {block.get('type')!r}")
    check_workout_ref(block, f"schedule {day}")
    alt = block.get("alternateWeekly")
    if alt and alt not in gym_categories:
        err(f"schedule {day}: alternateWeekly {alt!r} is not an exercise category")
    if block.get("extra"):
        check_workout_ref(block["extra"], f"schedule {day} extra")
    for i, opt in enumerate(block.get("options", [])):
        if opt.get("type") in ("gym", "run"):
            check_workout_ref(opt, f"schedule {day} option {i}")

if errors:
    print("\n".join(errors))
    sys.exit(f"\n{len(errors)} validation error(s)")
print(f"OK: {len(week)} days, {len(gym_categories)} categories, {len(run_ids)} running workouts")
