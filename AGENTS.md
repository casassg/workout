# AGENTS.md - AI Coding Agent Guidelines

Static weekly workout plan for Gerard, deployed to GitHub Pages (gerard.space/workout).

## Project Overview

A minimal static Hugo site showing the weekly workout plan (gym + running). No JavaScript, no localStorage, no tracking: it is a read-only PLAN. All training logs live in the private `/opt/data/fitness/log.yaml` (managed by the assistant), never in this repo.

## Build Commands

```bash
# Activate Hermit environment (provides hugo)
source bin/activate-hermit

# Production build
hugo --minify

# Build outputs to /public/
```

No tests or linting. Deploy automatic via GitHub Actions on push to `main`.

## Structure

- `/data/schedule.yaml` - weekly schedule (gym push/pull/legs, runs, rest). `extra` = secondary session of the day; `alternateWeekly` = alternates between two workouts by week.
- `/data/exercises/{push,pull,legs,abs,running}.yaml` - exercises with sets/reps/starting weights (kg) and instructions; `running.yaml` has `workouts` instead of `exercises`.
- `/layouts/` - three pages: `index.html` (today's session, rendered from the current weekday), `_default/week.html` (week overview), `_default/exercises.html` (full exercise catalog).
- `/layouts/partials/` - `exercise-item.html` (exercise card), `run-info.html` (run card), `day-block.html` (renders any day from schedule data + available exercises).
- `/content/` - thin pages: `_index.md`, `week.md` (layout: week), `exercises.md` (layout: exercises).

## Conventions

- Pure server-side rendering with Hugo data files. Never add JS for interaction; use `<details>/<summary>`.
- Simple CSS in `assets/css/main.css` (dark theme, CSS variables). No Tailwind.
- Keep the site in English. Keep private data (weights logged, metrics, diet) out of this repo.
- The assistant updates schedule/exercises on request; week count for `alternateWeekly` starts from the week of 2026-08-21 (Push = week A, Legs = week B).

## Editing Data

Edit `/data/schedule.yaml` or `/data/exercises/*.yaml`, then verify with `hugo --minify` and commit. Schedule keys: monday-sunday; each day: type (gym|run|rest|flexible), workout (exercise category or run id), duration (min), description, icon, includeAbs (gym), options (flexible), extra (secondary block).