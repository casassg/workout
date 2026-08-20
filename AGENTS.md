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
(https://wger.de/media/... demo image), `demo` (local GIF at `/exercises/<file>.gif` from the
exercises-dataset — preferred visual; validator checks the file exists), `alternatives:`
(list of `{id, name, equipment, description, image?, demo?}`).

Running workout: `id`, `name`, `type`, `duration` (string), `intensity` required; plus
`description`, `frequency`, `structure`, `tips` (list).

## Common workflows

- **Update a weight after a session**: edit `startingWeight` in the exercise's yaml, validate, commit.
- **Add/swap an exercise**: add to the category's `exercises:` list (or as an `alternative`), run validate.
- **Change the schedule**: edit `data/schedule.yaml`; `workout` refs must resolve (validator checks).
- **Find an exercise image**: `curl "https://wger.de/api/v2/exercise/search/?term=<name>&language=english&format=json"`, take `data[].data.image`, prefix `https://wger.de`, set `image:`.
- **Sync exercise data from the exercises-dataset (preferred)**: `uv run scripts/sync_exercises.py` enriches every exercise/alternative with a local `demo` GIF (copied into `static/exercises/`), fills missing `muscle`/`equipment` from the dataset, and auto-adds up to 3 relevant alternatives (same target + shared name token). It NEVER overwrites `sets`/`reps`/`startingWeight`/`notes`/curated `description`. Requires the dataset cloned at `/opt/data/exercises-dataset` (`--data <path>` to override, `--dry-run` to preview). Media © Gym visual — keep attribution.

Always run `uv run scripts/validate.py && hugo --minify` before committing data edits.
Keep the site in English. Keep private data (logged weights, metrics, diet) out of this repo.

## Gotchas

- `now`/`Date` in templates is evaluated at BUILD time. Never render the weekday server-side;
  `index.html` renders all 7 `data-day` sections hidden and `assets/js/main.js` unhides today's
  (with a Friday A/B alternation computed from the `data-alt-anchor` date). The `#today-date`
  string is a server fallback that main.js overwrites; `<noscript>` unhides everything.
- If the Today page looks frozen or wrong: check that all 7 `data-day` sections are present and
  main.js loads (fingerprinted as `js/main.min.*.js`). Don't bake `now` into visible content.
- The favicon is an inline percent-encoded SVG data URI in `layouts/_default/baseof.html`;
  keep the encoding when editing it.
- `config.toml` disables taxonomies (`disableKinds = ["taxonomy", "term"]`) so /tags/ and
  /categories/ are not generated.
- For build checks use a fresh output dir (e.g. `/tmp/wb-check-NN`); never `rm -rf` in /tmp
  without explicit approval.
- No frameworks, no external CDNs, no tracking. Extend `assets/js/main.js` if more behavior is
  ever needed; keep it small.
