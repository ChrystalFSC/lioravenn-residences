"""Prepare Lioravenn concept films from the existing, unbranded bg1.mp4.

Run with Python 3 and an existing FFmpeg executable:
    python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe
    python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe --hd

The default prepares the smaller MP4/WebM versions. --hd preserves those files
and prepares 1920x1080 H264 MP4 versions from the original source. Both modes
refresh the shared 1920x1080 posters. Clean source detail is 1712x964 after cropping;
1080p delivery therefore includes a modest Lanczos upscale, not extra detail.

No dependencies are installed. The source remains unchanged. Each source shot
has its baked letterbox bars cropped and its original black transition trimmed.
All generated videos are silent, 25 fps, and use a browser-compatible pixel format.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "videos/bg1.mp4"
FPS = 25
# Original 1920x1080 footage has black bars above y=60 and below y=1024.
# A small horizontal centre crop preserves 16:9 without stretching the image.
CROP = "crop=1712:964:104:60"
# Adjacent source shots contain six-frame black flashes plus brief dark fades.
# These intervals deliberately avoid both the flashes and the surrounding fades.
HERO_SHOTS = [(26.16, 31.60), (32.24, 37.68), (38.32, 44.64)]
FILM_SHOTS = [
    (1.40, 6.40),       # Beach / open-air leisure concept.
    (7.56, 12.56),      # Landscaped residential architecture.
    (20.00, 25.44),     # Architecture and pedestrian setting.
    (26.12, 31.60),     # Garden walk.
    (32.24, 37.68),     # Garden approach.
    (38.32, 44.64),     # Courtyard from above.
    (45.36, 49.44),     # Architectural details.
    (50.12, 53.44),     # View through warm architectural screening.
    (54.12, 57.76),     # Upward facade view.
]


def run(command: list[str]) -> None:
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])


def graph(shots: list[tuple[float, float]], size: tuple[int, int]) -> str:
    pieces = [f"[0:v]split={len(shots)}" + "".join(f"[s{i}]" for i in range(len(shots)))]
    pieces.extend(
        f"[s{i}]trim=start={start:.2f}:end={end:.2f},setpts=PTS-STARTPTS[v{i}]"
        for i, (start, end) in enumerate(shots)
    )
    pieces.append(
        "".join(f"[v{i}]" for i in range(len(shots)))
        + f"concat=n={len(shots)}:v=1:a=0,{CROP},scale={size[0]}:{size[1]}:flags=lanczos,setsar=1,fps={FPS},format=yuv420p[out]"
    )
    return ";".join(pieces)


def encode(ffmpeg: str, name: str, shots: list[tuple[float, float]], size: tuple[int, int], crf: int,
           bitrate: str, extensions: tuple[str, ...] = ("mp4", "webm"), preset: str = "medium",
           maxrate: str | None = None, bufsize: str | None = None) -> None:
    for extension in extensions:
        target = ROOT / "videos" / f"{name}.{extension}"
        print(f"Encoding {target.name} ({sum(end-start for start,end in shots):.2f}s, {size[0]}x{size[1]})", flush=True)
        command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-i", str(SOURCE),
                   "-filter_complex_threads", "2", "-filter_complex", graph(shots, size), "-map", "[out]", "-an"]
        if extension == "mp4":
            command += ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-threads", "2", "-g", "50",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            if maxrate and bufsize:
                command += ["-maxrate", maxrate, "-bufsize", bufsize]
            elif name == "lioravenn-lifestyle":
                command += ["-maxrate", "2400k", "-bufsize", "4800k"]
        else:
            command += ["-c:v", "libvpx", "-b:v", bitrate, "-crf", "31", "-deadline", "good", "-cpu-used", "2",
                        "-threads", "2", "-g", "100", "-pix_fmt", "yuv420p"]
        run(command + [str(target)])
        print(f"Ready: {target.name}, {target.stat().st_size:,} bytes", flush=True)


def poster(ffmpeg: str, name: str, second: float, size: tuple[int, int] = (1920, 1080), quality: int = 90) -> None:
    target = ROOT / "img/optimized" / name
    run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(second), "-i", str(SOURCE),
         "-frames:v", "1", "-vf", f"{CROP},scale={size[0]}:{size[1]}:flags=lanczos,setsar=1", "-an", "-c:v", "libwebp",
         "-quality", str(quality), "-threads", "2", str(target)])
    print(f"Ready: {target.name}, {target.stat().st_size:,} bytes", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="Path to an existing FFmpeg executable")
    parser.add_argument("--hd", action="store_true", help="Prepare only the 1080p MP4s and HD posters, preserving smaller video versions")
    args = parser.parse_args()
    if not args.ffmpeg or not Path(args.ffmpeg).is_file():
        parser.error("Supply --ffmpeg with an existing executable. This script does not download or install tools.")
    if not SOURCE.is_file():
        parser.error(f"Missing original source: {SOURCE}")
    (ROOT / "img/optimized").mkdir(parents=True, exist_ok=True)
    poster_size = (1920, 1080)
    poster_quality = 90
    poster(args.ffmpeg, "lioravenn-hero-poster.webp", 28.00, poster_size, poster_quality)
    poster(args.ffmpeg, "lioravenn-film-poster.webp", 47.00, poster_size, poster_quality)
    if args.hd:
        encode(args.ffmpeg, "lioravenn-hero-hd", HERO_SHOTS, (1920, 1080), 20, "", ("mp4",), "faster", "8M", "16M")
        encode(args.ffmpeg, "lioravenn-lifestyle-hd", FILM_SHOTS, (1920, 1080), 21, "", ("mp4",), "faster", "8M", "16M")
        names = ["lioravenn-hero-hd.mp4", "lioravenn-lifestyle-hd.mp4"]
    else:
        encode(args.ffmpeg, "lioravenn-hero", HERO_SHOTS, (960, 540), 27, "900k")
        encode(args.ffmpeg, "lioravenn-lifestyle", FILM_SHOTS, (1280, 720), 24, "1400k")
        names = ["lioravenn-hero.mp4", "lioravenn-hero.webm", "lioravenn-lifestyle.mp4", "lioravenn-lifestyle.webm"]
    for name in names:
        target = ROOT / "videos" / name
        run([args.ffmpeg, "-hide_banner", "-loglevel", "error", "-threads", "2", "-i", str(target), "-f", "null", "-"])
    print(json.dumps({"source": "videos/bg1.mp4", "heroShots": HERO_SHOTS, "filmShots": FILM_SHOTS,
                      "crop": CROP, "fps": FPS, "audio": False, "mode": "HD" if args.hd else "small",
                      "outputs": names, "validation": "All prepared outputs fully decoded without errors."}), flush=True)


if __name__ == "__main__":
    main()
