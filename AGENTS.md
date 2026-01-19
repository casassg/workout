# AGENTS.md - AI Coding Agent Guidelines

This document provides guidelines for AI agents working in this codebase.

## Project Overview

A Hugo-based workout companion web app for tracking gym and running workouts. Client-side only with localStorage persistence. Dark theme, mobile-friendly.

## Build Commands

```bash
# Activate Hermit environment (provides hugo and tailwindcss)
source bin/activate-hermit

# Development server with live reload
hugo server

# Production build
hugo --minify

# Build outputs to /public/
```

There are no tests or linting configured. Manual browser testing only.

## Tech Stack

- **Hugo** (v0.152+) - Static site generator
- **Tailwind CSS v4** - CSS framework (new CSS-based config, not JS)
- **Vanilla JavaScript** - No frameworks
- **localStorage** - Client-side data persistence
- **Hermit** - Tool version management (bin/ directory)

## Project Structure

```
/assets/
  css/main.css          # Tailwind v4 styles with @theme
  js/
    storage.js          # localStorage module
    app.js              # Main app logic (Today page)
    history.js          # History page logic
/content/
  _index.md             # Homepage
  week.md               # Week overview
  history.md            # History page
/data/
  schedule.yaml         # Weekly workout schedule
  exercises/
    push.yaml           # Push exercises
    pull.yaml           # Pull exercises
    legs.yaml           # Leg exercises
    abs.yaml            # Ab exercises
    running.yaml        # Running workouts
/layouts/
  index.html            # Homepage template
  _default/
    baseof.html         # Base template with blocks
    week.html           # Week page layout
    history.html        # History page layout
  partials/
    header.html         # Navigation
    footer.html         # Footer
    css.html            # CSS asset loading
    js.html             # JS asset loading
```

## JavaScript Conventions

### Module Pattern
No ES6 modules. Export via `window` object:

```javascript
// Exporting (storage.js)
window.Storage = {
  getUnit,
  setUnit,
  saveExerciseSet,
  // ...
};

// Consuming (app.js)
Storage.saveExerciseSet(exerciseId, data);
```

### Global Functions for HTML
Functions called from HTML onclick must be on window:

```javascript
window.toggleAlternatives = function(exerciseId) {
  // ...
};
```

### Naming Conventions
- **Functions/variables**: camelCase (`getExerciseHistory`, `currentWorkout`)
- **Constants**: SCREAMING_SNAKE_CASE (`STORAGE_KEYS`)
- **DOM IDs**: kebab-case (`exercise-list`, `unit-toggle`)
- **Exercise IDs**: snake_case (`bench_press`, `cable_fly`)

### Comments
Use JSDoc-style for functions:

```javascript
/**
 * Initialize today's workout view
 */
function initTodayWorkout(data) {
  // ...
}
```

### Error Handling
- Use early returns with guard clauses
- Use optional chaining: `data.schedule?.week?.[dayName]`
- Use defaults: `const value = stored || defaultValue`
- Log errors: `console.error('Exercise data not found')`

```javascript
function doSomething(data) {
  if (!data) return;
  
  const schedule = data.schedule?.week;
  if (!schedule) {
    console.error('No schedule found');
    return;
  }
  // ...
}
```

### Data Storage
- **All weights stored in kg internally**
- Convert for display: `Storage.displayWeight(weightKg)`
- Convert from input: `Storage.toKg(weight, Storage.getUnit())`
- 90-day retention for history data

## CSS/Tailwind Conventions

### Tailwind v4 Configuration
Configuration is in CSS, not JavaScript:

```css
@import "tailwindcss";
@source "hugo_stats.json";

@theme {
  --color-dark-bg: #0f0f0f;
  --color-accent-primary: #3b82f6;
  /* ... */
}
```

### Component Classes
Define in `@layer components`:

```css
@layer components {
  .exercise-card {
    @apply bg-dark-card border border-dark-border rounded-xl p-4;
  }
  
  .btn-primary {
    @apply bg-accent-primary text-white px-4 py-2 rounded-lg;
  }
}
```

### Color System
- `dark-bg`, `dark-card`, `dark-border`, `dark-text`, `dark-muted`
- `accent-primary` (blue), `accent-success` (green), `accent-warning` (orange), `accent-error` (red)

## Hugo Conventions

### Templates
- Use blocks in baseof.html: `{{ block "main" . }}{{ end }}`
- Override in page templates: `{{ define "main" }}...{{ end }}`
- Use partials for reusable components

### Data Access
```go-template
{{ range $.Site.Data.exercises.push.exercises }}
  {{ .name }}
{{ end }}
```

### JSON for JavaScript
```go-template
<script>
window.EXERCISE_DATA = {{- $data | jsonify | safeJS -}};
</script>
```

### Asset Processing
```go-template
{{ $css := resources.Get "css/main.css" | css.TailwindCSS }}
{{ if hugo.IsProduction }}
  {{ $css = $css | minify | fingerprint }}
{{ end }}
```

## Data Schemas

### Exercise (YAML)
```yaml
- id: "bench_press"           # snake_case, unique
  name: "Bench Press"         # Display name
  muscle: "Chest"             # Target muscle
  equipment: "Barbell + Bench"
  sets: 4
  reps: "8-12"                # String, can be range
  startingWeight: 20          # kg
  description: |              # Multi-line instructions
    Setup: ...
    Execution: ...
    Key points: ...
  alternatives:               # Optional
    - id: "dumbbell_press"
      name: "Dumbbell Press"
      equipment: "Dumbbells"
```

### Schedule (YAML)
```yaml
week:
  monday:
    type: "gym"               # gym|run|rest|flexible
    workout: "push"           # Exercise category or run ID
    duration: 60              # Minutes
    description: "..."
    icon: "🏋️"
    includeAbs: false
```

## Common Tasks

### Adding a New Exercise
1. Edit appropriate file in `data/exercises/`
2. Follow existing YAML schema
3. Include description with Setup/Execution/Key points

### Adding a New Page
1. Create content file: `content/newpage.md` with front matter
2. Create layout: `layouts/_default/newpage.html`
3. Add nav link in `layouts/partials/header.html`
4. Add JS if needed in `assets/js/` and load via `layouts/partials/js.html`

### Modifying Styles
1. Edit `assets/css/main.css`
2. Add theme colors in `@theme {}` block
3. Add component classes in `@layer components {}`

## Deployment

Automatic via GitHub Actions on push to `main`:
1. Activates Hermit
2. Runs `hugo --minify`
3. Deploys `/public/` to GitHub Pages
