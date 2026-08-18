# Workout site: maintenance prompt & conventions

Repo: casassg/workout · Live at https://gerard.space/workout/
Static Hugo site: plan only (gym + running). No tracking, no frameworks, no external assets.

## Paste this prompt to fix/extend the site (copy the block below)

```
Refactor/repair the workout site at /opt/data/workout (repo: casassg/workout, deploys to
https://gerard.space/workout/ via GitHub Pages). Read AGENTS.md first.

ARCHITECTURE (read-only plan site):
- Pure static Hugo server-side rendering from /data/schedule.yaml and /data/exercises/*.yaml.
- Pages: index (Today), week, exercises. No frameworks, no external assets.
- All client-side logic lives in assets/js/main.js (today's section reveal, Friday A/B
  alternation computed from the data-alt-anchor date, week reordering, exercise set checkoff
  stored in localStorage, service-worker registration). The index template renders every
  day section with data-day (and data-alt-week for alternating workouts) hidden, and main.js
  unhides the current day. Never bake the weekday sections server-side.
- PWA: static/manifest.webmanifest, static/sw.js, static/icons/. Keep them minimal.
- Data validation: scripts/validate.py (run: uv run scripts/validate.py; CI runs it on push).
- UI text in English. Private data (weight logs, metrics, diet) NEVER goes in this repo; the
  assistant keeps the log at /opt/data/fitness/log.yaml. Checkoff state is localStorage-only,
  never sent anywhere.

TASKS (do all that apply):
1. If the "Today" page looks frozen or wrong: check assets/js/main.js and the section
   rendering in layouts/index.html (all seven data-day sections must exist; fallback when JS
   is off is the <noscript> style that unhides everything). Do not bake the weekday into the
   visible content server-side; only the date string may be a server-rendered fallback that
   main.js overwrites.
2. Keep pages small: exercise descriptions and alternatives stay collapsed inside
   <details>/<summary>. Don't inline everything expanded.
3. Change the schedule only in /data/schedule.yaml (keys monday-sunday; type gym|run|rest|flexible;
   workout = exercise category or run id; duration, description, icon, includeAbs, options,
   extra, alternateWeekly). Friday alternates Push/Legs by week (week A starts 2026-08-21).
4. Add/change exercises only in /data/exercises/{push,pull,legs,abs}.yaml (id, name, muscle,
   equipment, sets, reps, startingWeight kg, notes, description, image (wger URL), alternatives)
   or running.yaml (workouts: id, name, type, duration, intensity, description, structure, tips).
5. Verify: uv run scripts/validate.py && source bin/activate-hermit && hugo --minify -d /tmp/wb-check,
   confirm /tmp/wb-check/{index.html,week/index.html,exercises/index.html} exist and contain
   expected content, then commit ("site: ...") and push. CI deploys automatically.
6. Do NOT run rm -rf in /tmp without explicit user approval; use a fresh output dir
   (mkdir /tmp/wb-check-NN) instead.

Report back: what was wrong, what changed, and the live URLs to check.
```

## Conventions summary

- Data-only YAML drives everything; templates are dumb renderers.
- Client logic stays in assets/js/main.js (day reveal, A/B alternation, checkoff, SW).
  If a feature needs more JS, extend main.js; no frameworks, no external asset CDNs.
- Friday alternates Push/Legs by week (week A starts 2026-08-21; alternateWeekly in schedule).
- Sunday is rest: no section content beyond the rest card.
- Kept deliberately boring: any 2026-ish Hugo + plain CSS knowledge is enough to extend it.

## Common gotchas

- hugo is provided by Hermit (source bin/activate-hermit); it is not on the system PATH.
- `now`/`Date` in templates is evaluated at BUILD time, so never render the weekday
  server-side; the weekday must come from the client (main.js). The date string in
  #today-date is a server fallback that main.js overwrites.
- config.toml disables taxonomies (disableKinds) so /tags/ and /categories/ are not generated.
- The favicon is an inline SVG data URI, percent-encoded, in layouts/_default/baseof.html;
  keep the encoding when editing it.