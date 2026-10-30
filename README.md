# FNF Shorts

A small site of short AI clips (made in Google Flow), styled to match
[FNF Arena Tracker](https://github.com/Hooee71/FNFTracker). It's a static site published to
GitHub Pages: push a clip, and a minute later it's live.

**Site:** https://hooee71.github.io/FNFShorts/

## Adding a clip

1. Download the clip from Flow as an **.mp4**.
2. Give it a name — the file name becomes the title (`bull-charges-in.mp4` → "Bull Charges In").
3. Drop it in the `clips/` folder, commit, and push to `main`.

GitHub Actions makes the poster image, reads the length and size, and publishes the site.
Landscape (16:9) and portrait (9:16) clips both work.

## Titles, tags and order (optional)

`clips.json` lets you set nicer titles, add tags (they become filter buttons) and a description:

```json
[
  { "file": "bull-charges-in.mp4", "title": "The Bull Charges In", "tags": ["Bull"], "date": "2026-10-30" },
  { "file": "fox-teleport.mp4", "title": "Blink!", "tags": ["Fox", "Funny"], "description": "Prompt: ..." }
]
```

| Field | What it does |
|---|---|
| `file` | The file name in `clips/` (required) |
| `title` | Shown on the card and player. Default: made from the file name |
| `tags` | Filter buttons across the top |
| `date` | Sorts Newest/Oldest. Default: the day the clip was first pushed |
| `description` | Shown under the title in the player, and searchable |
| `poster_at` | Second to grab the thumbnail from. Default: 1 |
| `hidden` | `true` keeps a clip in the repo but off the site |

Clips without an entry still show up. To have entries written for you, run
`python tools/build.py --manifest` (needs Python and ffmpeg) and then edit the titles.

## Preview locally

```
python tools/build.py
python -m http.server -d _site 8000
```

then open http://localhost:8000. Needs Python 3 and ffmpeg on your PATH (`winget install ffmpeg`).

## Sizes

GitHub rejects files over 100 MB and Pages sites should stay under 1 GB. An 8–10 second Flow clip
is usually a few MB, so a few dozen fit easily. If one is huge, shrink it first:

```
ffmpeg -i big.mp4 -c:v libx264 -crf 23 -preset veryfast -c:a aac -movflags +faststart clips/small.mp4
```

## One-time setup

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Credits

Background, mascots and logo art from FNF Arena Tracker. Marcellus font under the SIL Open Font
License (`assets/OFL.txt`).
