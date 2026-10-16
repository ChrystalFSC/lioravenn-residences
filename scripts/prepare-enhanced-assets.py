"""Re-encode the approved high-resolution concept images without upscaling.

Run after editing img/enhanced/manifest.json or one of its preserved masters.
This is separate from optimize-assets.py, which preserves the original gallery.
"""
from pathlib import Path
import json
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
folder = root / 'img/enhanced'
manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
for name, entry in manifest.items():
    with Image.open(root / entry['master']) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.save(folder / f'{name}.webp', 'WEBP', quality=entry.get('quality', 94), method=6)
        entry.update(width=image.width, height=image.height)
        print(f'{name}: {image.width}x{image.height}, {(folder / (name + ".webp")).stat().st_size:,} bytes')
(folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
