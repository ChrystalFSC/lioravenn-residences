# High-resolution concept imagery

These are AI-restored illustrative photographs for the fictional Lioravenn website. They preserve the composition and room arrangements of the original academic gallery, but reconstructed detail is not a verified property specification. Original source files remain in `img/gallery/` and their first WebP copies remain in `img/optimized/`.

The built-in image-generation tool was used in edit mode for `living_room`, `pool`, `bedroom3`, `LR3`, `bedroom` and `Garden Area`. Approved PNG masters are preserved in `masters/`; browser/PDF consumers use the high-quality WebPs in this folder. `bedroom5` uses its existing 1600×900 original with higher-quality encoding, without AI alteration. Exact dimensions and source paths are recorded in `manifest.json`.

To recreate the served files with Pillow installed, run `python scripts/prepare-enhanced-assets.py`. This preserves the full master dimensions; it does not enlarge pixels or re-run generation. The original asset optimizer cannot overwrite these separate enhanced assets.

## Restoration prompt set

All edit requests used the corresponding original file in `img/gallery/` as the only edit target. The shared brief was: **faithfully restore this exact property photograph at the highest available resolution; preserve camera angle, framing, geometry, doors, windows, furniture positions, objects, palette, materials and natural lighting; recover crisp believable fine texture and clean architectural edges; avoid blur, compression artifacts, halos and a plastic CGI appearance; add or remove no objects, people, branding, text or watermarks; keep the original landscape aspect ratio.** The preferred request was 3072 pixels wide, with actual delivered native dimensions retained as recorded in the manifest.

- `living_room`: the warm open-plan living/dining room, dark dining table, pendant lights and sofa at the back.
- `pool`: the same rooftop pool, white pergolas and two foreground wooden loungers.
- `bedroom3`: cream and dark-wood bedroom with vanity to the right.
- `LR3`: cream living room, white sofa left, grey rug, black/glass tables, TV right and black chair at the window.
- `bedroom`: built-in TV/cabinet left, bed right and curtains straight ahead.
- `Garden Area`: the same path, brick wall/building right, fence, mature trees and planting in warm afternoon light; preserve natural depth while sharpening paving, brickwork and foliage.

Floor-plan images have not been AI-edited. Their PDFs contain the same small raster sources; genuinely sharper plans require higher-resolution original drawings.
