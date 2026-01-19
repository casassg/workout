# Workout Companion

A personal workout tracker for balancing gym and running. Built with Hugo and Tailwind CSS, runs entirely in the browser with localStorage.

## Features

- **Daily workouts**: Push/Pull/Legs gym days + running schedule
- **Progress tracking**: Weight progression suggestions based on history
- **Week overview**: See your full week at a glance
- **Offline-first**: All data stored locally in your browser

## Development

Requires [Hermit](https://cashapp.github.io/hermit/) (or manually install Hugo and Node.js).

```bash
# Activate hermit environment
source bin/activate-hermit

# Start dev server
hugo server

# Build for production
hugo --minify
```

Dev server runs at `http://localhost:1313`

## Deployment

Automatically deploys to GitHub Pages on push to `main`.
