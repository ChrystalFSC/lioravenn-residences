# Development guide

[Back to the project overview](../README.md) · [Open the live website](https://chrystalfsc.github.io/lioravenn-residences/)

## Project background

A nature-inspired luxury residence website, reimagined from a university assignment. Built with plain HTML, CSS and JavaScript, with no build step. PDF export uses a bundled copy of jsPDF; no package installation is needed to run the website.

The brand pairs forest green, warm ivory and brass with an original L monogram, Cormorant Garamond headings, Manrope body text and the project's original imagery. Lioravenn is a coined name selected for this fictional concept; exact-name web searches on 16 October 2026 returned no matches. This is a preliminary naming check, not trademark clearance.

## Run locally

Open `index.html` directly, or serve the project for a consistent browser origin:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8765/`. The current demo is hosted at [chrystalfsc.github.io/lioravenn-residences](https://chrystalfsc.github.io/lioravenn-residences/).

## Explore

- **The Residence** — Cinematic garden-led landing page, residence collection, lifestyle stories and guided next steps.
- **Our Homes** — Bedroom and budget filters, saved favourites, comparison, original floor plans and an interactive concept site plan with building, level, outlook and layout choices.
- **The Lifestyle** — Editorial spaces, daily rituals and the nature-inspired design philosophy.
- **The Collection** — Filterable photography, an accessible image viewer and a four-room guided explorer.
- **Plan Your Purchase** — Editable loan assumptions, repayment estimate, principal/interest breakdown and up to three saved scenarios.
- **Plan a Viewing** — Selected-home continuity, date/contact preferences, honest draft confirmation and a downloadable viewing request.
- **Your Personal Brochure** — A live preview and downloadable A4 PDF containing selected homes, original floor plans, editable loan assumptions, an optional concept site selection and viewing questions.

Unit links preserve the choice using `?unit=type-a`, `?unit=type-b` or `?unit=type-c` between floor plans, calculator and viewing pages. Legacy `floor-plans.html#type-a` links also work.

The site plan lives at `floor-plans.html#site-plan`. A shared setting uses `?block=garden&level=mid&view=garden&unit=type-b#site-plan`; opening it does not automatically open a layout dialog. Building positions, levels and outlooks are clearly labelled fictional design scenarios, not verified orientation, inventory or reservations. Adding a setting to a brochure preserves the existing brochure shortlist.

Open `brochure.html` directly, from a layout, from a comparison or from the calculator. `?units=type-a,type-b` preselects an exact comparison. Saved favourites and the latest valid calculator down-payment/rate/term assumptions can be reused; estimates use each home's illustrative price. Only non-personal home IDs and concept selections are stored. Viewing questions stay in the open page and the downloaded PDF. Long questions continue onto additional pages; non-Latin questions are rendered locally as images while the brochure's main text remains selectable.

## Content and simulation

This is a fictional development. The Solis / Type A, The Luma / Type B and The Seren / Type C retain the original 947, 1,076 and 1,431 sq ft plans. Shared data in `js/data.js` keeps names, room counts and illustrative prices consistent.

The imagery is illustrative and is not a verified representation of a single development. The room explorer is an image-based experience, not a 360-degree tour. The original unrelated branded video is no longer presented as an Lioravenn tour.

The homepage uses two silent inline loops edited from the original unbranded `videos/bg1.mp4`. Playback now selects a capped-bitrate 1280×720 MP4 for typical desktops, or a 960×540 MP4 for narrow/coarse-pointer screens, known constrained hardware and slower connections. Both are H.264 Main Level 3.1, 25 fps, yuv420p, square-pixel, silent files with faststart metadata. The original 1080p and previous smaller encodes remain preserved; they are not the default MP4 download. The 1920×1080 still-image posters remain in place.

| Delivery | Hero | Lifestyle | Combined |
| :--- | ---: | ---: | ---: |
| Previous default 1080p MP4 | 17.97 MB | 43.19 MB | 61.16 MB |
| Balanced desktop MP4 | 2.85 MB | 8.31 MB | 11.16 MB |
| Smaller MP4 | 1.77 MB | 5.25 MB | 7.02 MB |

These are actual file sizes in decimal MB. The balanced pair transfers about **82% fewer bytes** than the previous default pair; this is a media-size comparison, not a measured frame-rate or page-load-speed claim. The source crop and shot timing are unchanged.

Video sources start buffering within 280 pixels of the viewport, while playback is restricted to visible videos in a visible tab. Repeated play requests are coalesced, and a pending play that is interrupted by scrolling can resume safely. A once-per-second check of the visible clip's playback clock detects unexpected native pauses, aborted ready starts and unresolved play promises. It tries the same buffered source once; actual playback progress resets that retry budget. Continued non-progress restores the poster and waits for an ordinary interaction, with no automatic download cascade. Health checks stop while the clip is offscreen, the tab is hidden or motion/data preferences restrict playback.

Persistent buffering or a source error can step down from balanced MP4 to the smaller MP4, then a supported WebM; exhausted candidates retain the poster. A rejected autoplay request waits for an ordinary user interaction instead of repeatedly downloading alternatives. Legacy media-query listeners are supported. Reduced-motion, data-saving and known 2G connections use still imagery. Enabling a restrictive network preference detaches active sources to stop continued buffering; a reduced-motion change alone preserves a ready clip for later reuse. Both loops stay muted and inline without playback buttons or popup players. The poster layer fades rather than making the video itself initially invisible.

Editorial reveals now run once per page and remain visible when scrolling back. Image wipes no longer animate a full-size clip mask. Chapter navigation and reading progress still follow either scroll direction. Hero/image movement is limited to capable fine-pointer desktops, updates only visible layers, and skips unchanged writes. Narrow, touch and known constrained devices keep the stationary composition with short reveals. Ordinary scrolling does not measure section geometry; toolbar-height-only changes avoid full layout walks. Forms, dialogs, site-plan controls and live brochure previews remain excluded. Motion preferences update live, and content fails open when observation is unavailable.

The fixed **Motion** control offers On, Auto and Off on every page. Motion is On by default for ordinary visits, enabling the website's animations and muted loops without a special link or an initial control selection. Saved visitor choices still take precedence. Auto follows the device's reduced-motion preference. Off retains still imagery and visible content. The choice is stored locally as `lioravenn-motion-preference`. A labelled `?motion=on` link also makes an explicit choice when opening the demo on another device. Data-saving and severely constrained video-connection safeguards still apply. Enabling motion re-arms only never-read content below the visitor's furthest reading position. **Copy playback status** copies non-personal preference and video-state details locally for troubleshooting; it does not send them anywhere.

Higher-resolution concept photographs live in `img/enhanced/`. Six small source photos were faithfully restored with the built-in image-generation tool; their reconstructed texture is illustrative, not verified property detail. Preserved masters, exact output dimensions and restoration prompts are documented in that folder. The existing 1600×900 bedroom photograph also has a higher-quality WebP copy. Enhanced images are used consistently by pages, gallery rooms/lightbox, home cards and brochure/PDF export. Floor plans retain their original geometry and raster source detail; sharper drawings would require higher-resolution originals.

The viewing form does **not** send an enquiry or reserve an appointment. It prepares a local draft, which the visitor can download. Contact details are not saved to local storage. Favourites and non-personal calculator assumptions/scenarios are stored only in the visitor's browser. No backend or sales inbox is connected.

Loan estimates assume a fixed annual rate and equal monthly payments, excluding ownership fees and other costs. The default sample rate is editable and is not a lending offer.

## Verification

```powershell
python scripts/check-site.py
node tests/floor-plans.test.cjs
node tests/site-plan.test.cjs
node tests/brochure-model.test.cjs
node tests/brochure-pdf.test.cjs
node tests/scroll-motion.test.cjs
node tests/ambient-videos.test.cjs
node tests/motion-preferences.test.cjs
```

The static audit checks seven active pages, exact-case file references, anchors, headings, branding and JavaScript syntax. Tests cover home-finder interactions, site-plan rules and DOM behavior, finance continuity/validation, safe data handling, PDF pagination and 132 scroll-motion assertions. The ambient-video suite covers 18 playback/resource lifecycle scenarios with 216 assertions; these use deterministic DOM/media fixtures rather than measuring real-device frame rate. Browser checks cover the connected site-plan/brochure journey, invalid and empty states, desktop/phone layouts, bidirectional chapter navigation, full-resolution gallery images and actual PDF downloads. Exported PDFs were rendered for visual inspection, including long multilingual questions and the enhanced image cover.

The pinned jsPDF 4.2.1 browser bundle and MIT license are in `js/vendor/`, with registry provenance and the verified package hash in that directory's README. PDF generation runs on the visitor's device; there is no upload or document service.

Optimized WebP copies live in `img/optimized/`; originals are preserved. The original-to-optimized copy set reduced its image payload by approximately 87%; this figure excludes the larger restored images now served from `img/enhanced/`. To regenerate them with Pillow installed:

```powershell
python scripts/optimize-assets.py
python scripts/prepare-enhanced-assets.py
```

To recreate the edited video clips and posters, supply an existing FFmpeg executable:

```powershell
python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe
python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe --hd
python scripts/prepare-films.py --ffmpeg C:/path/to/ffmpeg.exe --adaptive
```

The first command recreates the previous H.264 MP4 / VP8 WebM copies; `--hd` creates the preserved 1080p MP4s. Those two modes refresh the 1080p posters. `--adaptive` creates only the four new default/fallback MP4s, checks their browser-compatible format and full decoding, and verifies that existing media/posters remain unchanged. The preparation script preserves the original video, trims black transition frames and crops the baked letterbox bars. No video-processing dependency is needed to run the finished website.

## Original academic project

Originally developed as a group assignment for **CSS 3333 Web Technology**, UTS (University of Technology Sarawak), Year 2 Semester 2. The original author's contribution was the contact page, including Google Forms integration, FAQ, Google Maps and validation.

This refinement preserves the static multipage structure and original plan/image assets while replacing the branding, page design and visitor journey. Created for academic and demonstration purposes.
