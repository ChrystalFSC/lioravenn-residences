"""Create small WebP copies of the assignment's original imagery."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
output = root / 'img' / 'optimized'
output.mkdir(exist_ok=True)
original_bytes = optimized_bytes = 0
for directory in ('gallery', 'concept'):
    for source in (root / 'img' / directory).iterdir():
        if source.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        target = output / (source.stem + '.webp')
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600, 1200), Image.Resampling.LANCZOS)
            image.save(target, 'WEBP', quality=84, method=6)
        original_bytes += source.stat().st_size
        optimized_bytes += target.stat().st_size
print(f'Original imagery: {original_bytes:,} bytes; WebP copies: {optimized_bytes:,} bytes; reduction: {100*(1-optimized_bytes/original_bytes):.1f}%')
