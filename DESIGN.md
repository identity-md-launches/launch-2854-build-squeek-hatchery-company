# Squeek Hatchery design

## Overview
A warm, cozy single-page toy for players of all levels. The incubator (a dark plum stage holding a cream egg and a lamp on a rail) is the hero and the main action. Data panels sit beside it on desktop and below it on mobile. Copy is short and plain.

## Colors (src/style.css `:root`)
- `--color-bg` #fbf5ec: page. `--color-surface` #fffaf3: cards, buttons, sheet.
- `--color-text` #3b2a24: body text and focus ring (`--color-focus`). `--color-text-muted` #6b564c: notes and labels.
- `--color-border` #e8d6c0: button borders, meters, dividers.
- `--color-accent` #a8492a (hover #8f3c21), `--color-accent-text` #fff: the one primary button per view, links, progress.
- `--color-stage` #33263a / `--color-stage-text` #f6ebe0: incubator stage and pause overlay.
- Signal pill: `--color-rest` #e9f1e4 (resting), `--color-run` #fbe7d3 (running), `--color-missing` #f6dede (missing).
- `--lamp`: set at runtime from the live lamp color (beam, glow, bulb).
- The artwork uses fixed palette values in src/art.ts (fur #fbeedb to #ead2b3, outline #b08d72, eyes #2f2523).

## Typography
- Font: `--font` = ui-rounded, "SF Pro Rounded", Nunito, Segoe UI, system-ui. No web fonts are loaded.
- Size scale: `--text-sm` 13px (notes, labels, pills), `--text-base` 16px (body), `--text-md` 18px (h3), `--text-lg` 22px (h2, timer, name), `--text-xl` 28px (h1 on mobile), `--text-2xl` 36px (h1 from 640px).
- Weights: 400 for body, 700 for labels/buttons/h2/h3, 800 for h1. Headings use line-height 1.15 with balanced wrapping; body uses 1.5. Numbers use tabular-nums.
- Reviewed names keep the 22px size and saved names keep 18px; both wrap anywhere with line-height 1.4. Exact counters keep 16px tabular numbers and wrap instead of clipping, shrinking or using ellipses.

## Layout
- Spacing tokens `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8` (4, 8, 12, 16, 24, 32 px). Content max 1180px with 16px inline padding.
- Under 980px: one column (hero, incubator, panels). From 980px: incubator and panels side by side at 1.25fr:1fr; the stage is capped at `100svh - 330px` so the start button stays on screen.
- From 640px: header nav is shown and the wallet sheet is centered (a bottom sheet below that).
- The stage keeps a 400:420 aspect ratio; the SVG and the HTML lamp handle share that coordinate system (src/rules.ts `STAGE`, `lampGeometry`).
- Grid children can shrink with `min-width: 0`. The two `.stats` columns use `minmax(0, 1fr)`; locked-work notes and trait values wrap full counters too. Browser checks covered 320, 390, 768 and 1440px, including supported 30-character names and 78-digit work counters on mobile.

## Elevation and depth
Cards use `--shadow` (two soft layers) and no border. Buttons use a 1.5px border and no shadow. The sheet sits on a 45% plum backdrop. The pause overlay is an 88% plum panel on the stage.

## Shapes
`--radius-sm` 10px (inputs, sheet rows), `--radius-md` 16px (cards, sheet), `--radius-lg` 24px (stage, portrait). Buttons and pills are fully rounded (999px).

## Components
- `.btn` with `.primary`, `.small` and `.warn` variants: rest, hover, pressed (scale .97), focus-visible and disabled (60%). 48px tall, 44px for small.
- `.card`: panel with a heading and `.note` text; `.stats` (dl grid), `.pair` (swatch or miniature with caption), `.traits` meters.
- `.pill[data-state]`: signal state. `.swatch` / `.mini` with an `.off` hatched pattern meaning unavailable.
- Stage: `#stage-svg` layers (animal, shell with feathered window mask, beam, rail, lamp) plus `.lamp-handle` (role slider) and `.rail-hit`.
- Connect sheet (`.sheet-bg`, `.sheet`, `.row`, `.ic`, `.x`) built in src/app.ts `openSheet()`.
- Result: name form, then a review panel with portrait, traits, save/download buttons and `.mint-box`.
- During mint checking, signing and confirmation, Change name and Hatch another are disabled and their handlers are guarded. Rejection/failure restores them. On success the review, saves and downloads use the frozen minted record; renaming stays hidden.
- `public/og-image.png`: 1200×630 share card using the existing hamster SVG, cream background and brown type. Regenerate with `scripts/share-card.mjs`; its portrait is inline so it has no external image dependency.

## Do's and don'ts
- Use the semantic tokens; don't hard-code new colors in components. Keep one filled `.primary` per view.
- Put directions next to the control they describe. Don't add small tracked caps above headings.
- Render animals only through `animalGroup()` / `portraitSVG()` so the stage, download and token match.
- New page recipe: `main` > `section` with an h2, `.card` panels inside `.panels`, actions as `.btn`.

Review guidance: Jakub Krehel's Better Interface (MIT) and Paul Bakaus's Impeccable documentation method (Apache-2.0), supplied as pinned references. The revision preserves the existing visual system.
