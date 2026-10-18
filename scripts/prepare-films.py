"""Prepare Lioravenn concept films from the existing, unbranded bg1.mp4.

Run with Python 3 and an existing FFmpeg executable:
    python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe
    python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe --hd
    python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe --adaptive

The default prepares the smaller MP4/WebM versions. --hd preserves those files
and prepares 1920x1080 H264 MP4 versions from the original source. Both modes
refresh the shared 1920x1080 posters. Clean source detail is 1712x964 after cropping;
1080p delivery therefore includes a modest Lanczos upscale, not extra detail.
--adaptive prepares separate 540p mobile and 720p balanced MP4s with capped
bitrates, H264 Main level 3.1, two B-frames and a two-second keyframe interval.
This mode preserves all existing source/HD/small files and posters unchanged.

No dependencies are installed. The source remains unchanged. Each source shot
has its baked letterbox bars cropped and its original black transition trimmed.
All generated videos are silent, 25 fps, and use a browser-compatible pixel format.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
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
# Bounded progressive-download variants: retain the original edited composition
# and timing while reducing bandwidth and hardware decoder requirements.
ADAPTIVE_VARIANTS = [
    ("lioravenn-hero-mobile", HERO_SHOTS, (960, 540), "800k", "1200k", 2_000_000),
    ("lioravenn-lifestyle-mobile", FILM_SHOTS, (960, 540), "950k", "1900k", 6_000_000),
    ("lioravenn-hero-balanced", HERO_SHOTS, (1280, 720), "1300k", "1300k", 3_000_000),
    ("lioravenn-lifestyle-balanced", FILM_SHOTS, (1280, 720), "1500k", "3000k", 9_000_000),
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
           maxrate: str | None = None, bufsize: str | None = None,
           adaptive: bool = False) -> None:
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
            if adaptive:
                command += ["-profile:v", "main", "-level:v", "3.1", "-bf", "2", "-refs", "2",
                            "-keyint_min", "50", "-sc_threshold", "0"]
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


def mp4_configuration(target: Path) -> dict:
    """Read faststart order and the actual AVC profile/level without ffprobe."""
    atoms = []
    profile = level = None
    with target.open("rb") as stream:
        while True:
            header = stream.read(8)
            if len(header) < 8:
                break
            length, kind = struct.unpack(">I4s", header)
            header_size = 8
            if length == 1:
                length = struct.unpack(">Q", stream.read(8))[0]
                header_size = 16
            if not length:
                break
            if length < header_size:
                raise RuntimeError(f"Invalid MP4 box in {target.name}")
            atoms.append(kind)
            if kind == b"moov":
                movie = stream.read(length - header_size)
                marker = movie.find(b"avcC")
                if marker >= 0 and movie[marker + 4] == 1:
                    profile, level = movie[marker + 5], movie[marker + 7]
            else:
                stream.seek(length - header_size, 1)
    return {"profileIdc": profile, "levelIdc": level,
            "faststart": b"moov" in atoms and b"mdat" in atoms and atoms.index(b"moov") < atoms.index(b"mdat")}


def probe_adaptive(ffmpeg: str, target: Path, expected_size: tuple[int, int], maximum_bytes: int) -> dict:
    """Use an installed ffprobe when present, otherwise FFmpeg's stream probe."""
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        result = subprocess.run([ffprobe, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(target)],
                                capture_output=True, text=True, check=True)
        metadata = json.loads(result.stdout)
        video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        duration = float(metadata["format"]["duration"])
        rate_numerator, rate_denominator = map(float, video["r_frame_rate"].split("/"))
        facts = {"probe": "ffprobe", "codec": video["codec_name"], "profile": video["profile"],
                 "pixelFormat": video["pix_fmt"], "width": video["width"], "height": video["height"],
                 "fps": rate_numerator / rate_denominator, "sar": video["sample_aspect_ratio"],
                 "durationSeconds": duration, "audio": any(stream["codec_type"] == "audio" for stream in metadata["streams"])}
    else:
        result = subprocess.run([ffmpeg, "-hide_banner", "-i", str(target), "-map", "0:v:0", "-c:v", "copy",
                                 "-frames:v", "1", "-an", "-f", "null", "-"], capture_output=True, text=True, check=True)
        metadata = result.stderr.split("Output #0", 1)[0]
        video = next(line for line in metadata.splitlines() if "Video:" in line)
        dimensions = re.search(r"\b(\d{2,5})x(\d{2,5})\b", video)
        duration_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", metadata)
        duration = int(duration_match[1]) * 3600 + int(duration_match[2]) * 60 + float(duration_match[3])
        facts = {"probe": "FFmpeg stream metadata + AVC configuration", "codec": "h264" if "h264" in video else "unknown",
                 "profile": "Main" if "(Main)" in video else "unknown", "pixelFormat": "yuv420p" if "yuv420p" in video else "unknown",
                 "width": int(dimensions[1]), "height": int(dimensions[2]),
                 "fps": float(re.search(r"([\d.]+) fps", video)[1]),
                 "sar": re.search(r"SAR (\d+:\d+)", video)[1], "durationSeconds": duration, "audio": "Audio:" in metadata}
    facts.update(mp4_configuration(target))
    facts.update(file=f"videos/{target.name}", bytes=target.stat().st_size,
                 averageKbps=round(target.stat().st_size * 8 / duration / 1000, 1))
    assert facts["codec"] == "h264" and facts["profile"] == "Main", facts
    assert facts["profileIdc"] == 77 and facts["levelIdc"] == 31, facts
    assert facts["pixelFormat"] == "yuv420p" and facts["sar"] == "1:1", facts
    assert (facts["width"], facts["height"]) == expected_size and facts["fps"] == FPS, facts
    assert facts["faststart"] and not facts["audio"] and facts["bytes"] <= maximum_bytes, facts
    return facts


def adaptive_films(ffmpeg: str) -> list[str]:
    names = [f"{variant[0]}.mp4" for variant in ADAPTIVE_VARIANTS]
    protected_paths = [path for path in (ROOT / "videos").iterdir()
                       if path.is_file() and path.suffix in (".mp4", ".webm") and path.name not in names]
    protected_paths += list((ROOT / "img/optimized").glob("*poster.webp"))
    preserved = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in protected_paths}
    for name, shots, size, maxrate, buffer, maximum_bytes in ADAPTIVE_VARIANTS:
        encode(ffmpeg, name, shots, size, 24, "", ("mp4",), "fast", maxrate, buffer, adaptive=True)
        target = ROOT / "videos" / f"{name}.mp4"
        run([ffmpeg, "-hide_banner", "-loglevel", "error", "-threads", "2", "-i", str(target), "-f", "null", "-"])
        print(json.dumps(probe_adaptive(ffmpeg, target, size, maximum_bytes)), flush=True)
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() == digest for path, digest in preserved.items()), "Protected source/media/poster changed"
    print(f"Verified {len(preserved)} existing media/poster files unchanged by SHA-256.", flush=True)
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="Path to an existing FFmpeg executable")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--hd", action="store_true", help="Prepare only the 1080p MP4s and HD posters, preserving smaller video versions")
    modes.add_argument("--adaptive", action="store_true", help="Prepare new 540p mobile/720p balanced MP4s only; preserve existing media and posters")
    args = parser.parse_args()
    if not args.ffmpeg or not Path(args.ffmpeg).is_file():
        parser.error("Supply --ffmpeg with an existing executable. This script does not download or install tools.")
    if not SOURCE.is_file():
        parser.error(f"Missing original source: {SOURCE}")
    if args.adaptive:
        names = adaptive_films(args.ffmpeg)
        print(json.dumps({"source": "videos/bg1.mp4", "heroShots": HERO_SHOTS, "filmShots": FILM_SHOTS,
                          "crop": CROP, "fps": FPS, "audio": False, "mode": "adaptive", "outputs": names,
                          "validation": "All adaptive outputs fully decoded and stream configuration checked."}), flush=True)
        return
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
