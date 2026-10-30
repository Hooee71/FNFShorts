#!/usr/bin/env python3
"""Build the FNF Shorts site into _site/.

    python tools/build.py              build _site/ (what GitHub Actions runs)
    python tools/build.py --manifest   also add any new clips to clips.json so you can edit their titles

Every video in clips/ is published. clips.json is optional metadata (title, tags, description, date)
keyed by file name; clips without an entry get a title made from the file name.
Needs ffmpeg + ffprobe on PATH (for posters, duration and size).
"""
import argparse, json, re, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ROOT / "clips"
MANIFEST = ROOT / "clips.json"
OUT = ROOT / "_site"
STATIC = ["index.html", "site.css", "site.js", "assets"]
VIDEO_EXT = {".mp4", ".webm", ".m4v"}


def slug(stem):
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "clip"


def title_from(stem):
    words = re.sub(r"[_\-]+", " ", stem).strip()
    return " ".join(w if w.isupper() else w.capitalize() for w in words.split()) or stem


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def probe(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                           "-show_entries", "stream=width,height:format=duration", "-of", "json", str(path)]))
    s = (data.get("streams") or [{}])[0]
    return int(s.get("width") or 0), int(s.get("height") or 0), round(float(data["format"].get("duration") or 0), 2)


def added_date(path):
    """When the clip was first committed (falls back to the file's modified time)."""
    try:
        out = run(["git", "-C", str(ROOT), "log", "--diff-filter=A", "--follow", "--format=%cI", "--", str(path)])
        dates = out.split()
        if dates:
            return dates[-1][:10]
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d")


def load_manifest():
    if not MANIFEST.exists():
        return []
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return data.get("clips", data) if isinstance(data, dict) else data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", action="store_true", help="add new clips to clips.json")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} not found on PATH")

    entries = load_manifest()
    meta = {e["file"]: e for e in entries if isinstance(e, dict) and e.get("file")}
    files = sorted(p for p in CLIPS.glob("*") if p.suffix.lower() in VIDEO_EXT) if CLIPS.exists() else []
    on_disk = {p.name for p in files}
    for name in meta:
        if name not in on_disk:
            print(f"warning: clips.json lists {name}, but clips/{name} doesn't exist", file=sys.stderr)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "clips").mkdir(parents=True)
    (OUT / "posters").mkdir()
    for item in STATIC:
        src = ROOT / item
        (shutil.copytree if src.is_dir() else shutil.copy2)(src, OUT / item)

    clips, used_ids, new_entries = [], set(), []
    for path in files:
        m = meta.get(path.name, {})
        if m.get("hidden"):
            continue
        cid = base = slug(m.get("id") or path.stem)
        n = 2
        while cid in used_ids:
            cid, n = f"{base}-{n}", n + 1
        used_ids.add(cid)

        # Copy with the index moved to the front ("faststart") so playback starts before the whole file loads.
        dest = OUT / "clips" / path.name
        try:
            run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-map", "0", "-c", "copy", "-movflags", "+faststart", str(dest)])
        except subprocess.CalledProcessError:
            shutil.copy2(path, dest)

        width, height, duration = probe(path)
        poster = OUT / "posters" / f"{cid}.jpg"
        at = m.get("poster_at", min(1.0, duration / 3 if duration else 0))
        scale = "scale=-2:640" if height > width else "scale=640:-2"
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", str(path), "-frames:v", "1",
             "-vf", scale, "-q:v", "4", str(poster)])

        clip = {
            "id": cid,
            "file": path.name,
            "src": f"clips/{path.name}",
            "poster": f"posters/{cid}.jpg",
            "title": m.get("title") or title_from(path.stem),
            "date": m.get("date") or added_date(path),
            "tags": m.get("tags") or [],
            "width": width, "height": height, "duration": duration,
        }
        if m.get("description"):
            clip["description"] = m["description"]
        clips.append(clip)
        if path.name not in meta:
            new_entries.append({"file": path.name, "title": clip["title"], "tags": [], "date": clip["date"]})
        print(f"  {path.name}: {width}x{height}, {duration}s")

    (OUT / "clips.json").write_text(json.dumps({"clips": clips}, indent=1), encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    print(f"Built {len(clips)} clip(s) into {OUT.relative_to(ROOT)}/")

    if args.manifest and new_entries:
        MANIFEST.write_text(json.dumps(entries + new_entries, indent=2) + "\n", encoding="utf-8")
        print(f"Added {len(new_entries)} new clip(s) to clips.json — edit their titles and tags there.")


if __name__ == "__main__":
    main()
