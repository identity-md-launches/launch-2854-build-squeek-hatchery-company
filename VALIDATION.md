# Revision validation (2026-11-02)

The five reopened findings were reproduced in the previous production export and corrected in the existing implementation. The source, lockfile and rebuilt `dist/` are delivered. This is worker-side evidence, not an independent certification.

The wider assignment remains **incomplete for public Sepolia deployment**: no authorized funded signer was supplied, so deployment, source verification and a public testnet mint remain unperformed. `public/hatchery.config.json` and its exported copy retain an honest `null` contract address, and the site explains that minting is unavailable. README.md retains the authorized deployment/configuration path. No address, live hardware data, deployment, transaction or check result was fabricated. Local test fixtures are confined to validation scripts.

## Findings reproduced and fixes

| Finding | Reproduction in the previous export | Correction and recheck |
| --- | --- | --- |
| Replay baseline (`src/app.ts:22`, `src/app.ts:198`) | Accept 1,000 units, then repeatedly send the same epoch at 900 units and an older observed timestamp with fresh receipt times. The timer paused at 0:57, then advanced to 0:46 and displayed 900. Network, stale, simulated and fault interruptions also erased the baseline. | Keep `replayBaseline` separately from the usable `reading`; only accepted measurements replace it. Repeated replays remain unavailable and paused at 0:57. Newer valid data resumes after three seconds, and a valid epoch reset resumes without changing the egg's locked pattern. |
| Mobile overflow (`src/style.css:74`, `src/style.css:110`, `src/style.css:142`, `src/style.css:154`) | A 30-W name produced a 728px name box and 760px page at 320px. The reported 19-digit counter produced a 365px page; the supported 78-digit limit produced 1,137px. | Allow grid children to shrink, use `minmax(0, 1fr)` stats columns, and wrap complete names and counters, including locked-work and trait values. Keep existing type sizes; no clipping or ellipsis. Reflow checks cover the name and collection at 320/390/768/1440, and counters at 320/390 before and after locking. |
| Share image (`public/og-image.png`, `scripts/share-card.mjs:1`) | Visual inspection confirmed the broken-image glyph was baked into the old PNG. | Capture the site's existing inline hamster SVG with the existing cream/brown identity. Inspected the regenerated illustration; source/export PNGs are identical and decode as 1200×630. No image requests or unresolved image element are used. |
| Pending mint rename (`src/app.ts:444`, `src/app.ts:485`, `src/app.ts:613`) | Hold the local wallet send request, rename Original Pip to Changed Pip, release it, and read tokenURI: token/collection said Original Pip; review/JSON said Changed Pip. | Disable and guard rename/form submission and starting another egg while busy. Render success from the frozen minted record; saves and downloads use that record. The local-chain browser check passes with all four names Original Pip, exact SVG/metadata equality, rejection/failure recovery, and checking/signing/pending guards. |
| Repeated first-screen copy (`src/app.ts:58`, `src/app.ts:233`) | The pinned probe measured 50 prose words on mobile and 128 on desktop with valid IDLE data. | Shorten the lead, resting state, pre-lock note and idle ETA. Keep directions, hardware caveat, real amounts and rate-based estimates. Final probe: 36 prose words at 390 and 83 at 1440. |

Full finding IDs and individual verdicts are in `.imd-responses.json`.

## Build and interaction checks

Dependencies were installed using the unchanged lockfile in a temporary source mirror, keeping all dependency directories outside the submission. The final source was copied into that mirror, built, and its clean export copied back to `dist/`. The direct initial build had no installed TypeScript compiler; installing dependencies in the temporary mirror resolved it.

- `npm run typecheck`: pass, `tsc --noEmit`.
- `npm run build`: pass, TypeScript then Vite 8.3.5, with relative `./assets/` URLs. The existing dependency emitted a `node:worker_threads` browser-externalization warning; there were no application page errors in the tested flows.
- `npm test`: 12/12 pass, covering status/schema/provenance/freshness, BigInt arithmetic, lamp power, color passages, 50-unit patterns, locking, idle light development, local preservation and exact art/metadata.
- `node --experimental-strip-types --test tests/contract.chain.ts`: 1/1 pass on an isolated Anvil chain with chain ID 11155111. The unchanged contract was compiled using solc-js 0.8.30, optimizer 200 runs, Prague (matching foundry.toml), and the locked OpenZeppelin dependency. tokenURI equals local JSON; duplicate sessions, invalid inputs, nonpayable mint and size caps pass. Gas: 8,348,087 typical and 9,772,000 at the caps. This was a local test, not Sepolia deployment.
- `PLAYWRIGHT=<external module> node tests/revision.mjs`: pass, 8/8 built-export Chromium regressions (repeated replay, four interruption/recovery cases, long names/collection/download equality, and two counter sizes). It serves the actual `dist/` under `/preview/`, intercepts hardware fixtures only in the browser context, and uses a virtual clock to advance valid play without changing the production timer.
- `MINT_CHAIN=1 MINT_ONLY=1 PLAYWRIGHT=<external module> node tests/revision.mjs`: pass, using the actual ERC721 on a disposable Anvil chain. The harness deploys Multicall3 and copies its runtime to the Sepolia helper address on that local chain, without changing production RPCs or configuration. Tested EIP-6963 connection, wrong-chain display/switch, user rejection, RPC failure/recovery, held signing, pending receipt, success/token links, frozen names/art/traits, prevention of a second send, and on-chain duplicate-session rejection from another test account.
- `PLAYWRIGHT=<external module> node scripts/share-card.mjs`: pass; regenerated the PNG from a self-contained SVG. The final production build includes it.
- WebKit was attempted but could not launch because required runtime dependencies were unavailable. No WebKit/Safari behavior is claimed.

The older `tests/e2e.ts` was not changed. Its previous SVG string-serialization comparison and wallet-connection assumptions are superseded by the revision harness: it compares portrait DOM nodes after normalization, tests downloaded SVG against JSON and tokenURI, starts the test wallet unauthorized, and deliberately emits a wrong-chain change after connection. No production connector changes were needed.

## Design probe and rendered inspection

Final command: `IMD_PLAYWRIGHT=<external module> node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`.

Result: **15/16 pass**. Render, layout, targets, contrast, casing, tracking, sizes, faces, glyphs, slogans, repetition, copy budget, chrome, motion and share all pass. The remaining `eyebrows` warning calls the required header Connect control a kicker above the h1 at 390. It is an actual wallet button in the conventional header position, not introductory copy; kept as required. No unrelated header redesign was made.

The final 390×844 screen was inspected through the assigned browser tool: egg, lamp, directions, aim controls and Begin incubation are visible, with page width equal to the viewport. The rail accepts pointer input, focuses the slider, and ArrowDown changes the lamp position. The focused state was captured. The 1440×900 view was also inspected; the same product and live panels render in two columns. Browser console reported zero errors during that inspection. The probe separately checks 320/390/1440 reflow and reduced motion. Saved evidence is under `test/scratch/taste/shots/`, `test/scratch/browser-mobile.png`, `test/scratch/final-mobile.png`, `test/scratch/final-desktop.png`, `test/scratch/browser-tools/` and `test/scratch/revision/`; scratch evidence is intentionally excluded from submission.

## Better Interface coverage

The pinned Better Interface workflow and core principles of all six domains were read and applied to the changed surfaces. The existing cozy plum/cream stage, artwork, typography and component system were preserved. DESIGN.md now records the actual wrapping, grids, mint states and share-card generation.

| Domain | Checked and corrected | Limits |
| --- | --- | --- |
| Accessibility | Native disabled states and explicit guards throughout pending mint; name label/error relationship retained; lamp keyboard/focus inspected; status text remains distinct from color. | No screen-reader session or automated full accessibility audit. |
| Layout | Real supported names and exact counters reflow; shrinkable grid children; product/action visible at 390; measured reflow at 320/390/768/1440; visually inspected mobile stress cases and mobile/desktop probe views. | No browser-native 200% zoom, RTL or physical-device test. |
| Writing | Removed repeated directions from the lead and shortened resting/ETA/lock copy. Signal-loss explanation, hardware caveat, thresholds and measured waits remain. | No localization scope; English only. |
| Typography | Existing six-token scale and three weights retained; full important text wraps at unchanged sizes; multi-line names use line-height 1.4. | Intended system-font fallback varies by platform; no new font loading claims. |
| Colors | Existing semantic tokens retained; final probe passes measured solid text/background pairs at 4.5:1 (3:1 for large text). | Artwork/gradient and every disabled alpha blend are not a comprehensive contrast certification. |
| UI | Checking/signing/pending/rejection/failure/success states exercised with the real local contract; reviewed portrait, download and token match; regenerated share asset visually inspected. | WebKit could not run; no wallet app, Coinbase passkey or physical-device end-to-end session. No 10%-speed Animations-panel review. |

## Remaining limits

- A funded, explicitly authorized Sepolia deployment/signing path is still needed for public deployment, source verification and a live mint. The configured address remains null; nothing substitutes for that missing deployment.
- Earlier prototype v1 collections are not imported. The shell window and coat remain the accepted 2D vertical-band model. Work units are API units, not verified wheel turns; player-supplied art is not proof of a hardware session.
- Final integrity check: all required source, lockfile, documentation, response JSON and export paths exist and are nonempty; local relative asset URLs resolve. `dist/` is 427,962 bytes; the complete source/export/documentation bundle is under 700,000 bytes (limit 8,388,608). No `.gitignore` change, dependency directory, cache, source map or npm archive is included.
