# AGENTS.md

Gerard's weekly workout plan (Hugo static site + light vanilla JS), deployed to GitHub Pages.
Training logs live in `/opt/data/fitness/log.yaml`, NEVER in this repo. Set checkoff on the
today page is client-only localStorage, not synced anywhere.

## Commands

```bash
source bin/activate-hermit     # provides hugo
uv run scripts/validate.py     # validate data files (also runs in CI before deploy)
hugo --minify                  # build to /public
hugo server                    # local preview
```

Deploy is automatic on push to `main`. CI fails if validation fails.

## Structure

- `data/schedule.yaml` — the weekly plan (source of truth for what happens each day).
- `data/exercises/{push,pull,legs,abs}.yaml` — gym exercises; `running.yaml` — run workouts.
- `layouts/` — `index.html` (today: all 7 days rendered, JS picks one), `week.html` (next 7 days), `exercises.html` (catalog). Partials: `day-block`, `exercise-item`, `run-info`.
- `assets/js/main.js` — day selection, Friday push/legs alternation (anchor 2026-08-21 = week A = push), week reorder, set checkoff. `static/sw.js` + `static/manifest.webmanifest` — PWA.

## Schema: data/schedule.yaml

`week:` must have all 7 keys `monday`–`sunday`. Each day:

| field | notes |
|---|---|
| `type` | `gym` \| `run` \| `rest` \| `flexible` (required) |
| `workout` | gym: exercise category (`push`/`pull`/`legs`/`abs`); run: running workout `id` |
| `alternateWeekly` | gym only: second category; alternates with `workout` by week |
| `duration` | minutes (0 for rest) |
| `description`, `icon` | shown on cards |
| `includeAbs` | gym only: append first 3 abs exercises |
| `extra` | optional secondary block: `{type, workout, duration, description, icon}` |
| `options` | flexible/choice days: list of blocks like `extra` |

## Schema: data/exercises/*.yaml

Top level: `category`, `description`, `icon`, `exercises:` (or `workouts:` in running.yaml).

Exercise: `id`, `name`, `sets`, `reps` (int or string like `"45s"`) required; plus `muscle`,
`equipment`, `startingWeight` (kg), `notes`, `description` (multiline how-to), `image`
(https://wger.de/media/... demo image), `alternatives:` (list of `{id, name, equipment,
description, image?}`).

Running workout: `id`, `name`, `type`, `duration` (string), `intensity` required; plus
`description`, `frequency`, `structure`, `tips` (list).

## Common workflows

- **Update a weight after a session**: edit `startingWeight` in the exercise's yaml, validate, commit.
- **Add/swap an exercise**: add to the category's `exercises:` list (or as an `alternative`), run validate.
- **Change the schedule**: edit `data/schedule.yaml`; `workout` refs must resolve (validator checks).
- **Find an exercise image**: `curl "https://wger.de/api/v2/exercise/search/?term=<name>&language=english&format=json"`, take `data[].data.image`, prefix `https://wger.de`, set `image:`.

Always run `uv run scripts/validate.py && hugo --minify` before committing data edits.
Keep the site in English. Keep private data (logged weights, metrics, diet) out of this repo.
