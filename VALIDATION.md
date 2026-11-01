# Validation record (2026-11-01)

Completion: **Incomplete.** Website, rules, art, contract and local tests are done; Sepolia deployment, source verification and a live testnet mint were not performed (no authorized funded signer was available), and the browser wallet path has an open defect (below).

## Commands run
- `npx tsc --noEmit`: pass. `npx vite build`: pass, dist/ 432 KB, relative `./assets/` URLs.
- `npm test` (tests/rules.test.ts): 12/12 pass: validation incl. stale/simulated/derived/COUNTER_FAULT/replay, BigInt work, lamp power, 5 m colors, pearl/rainbow bounds, 50-unit buckets, 67000 stars / 67050 ordinary / 68000 swirls, no 200-unit windows, lock retention, idle pattern development without work, region isolation, color replacement, surface-normal lamp aim, portrait/metadata equality and size caps.
- `npm run contract:test` on local anvil (chain id 11155111): pass. Exact tokenURI metadata matches the download, duplicate session refused from another wallet, name/SVG/traits/empty-session validation, nonpayable, gas 8,348,087 typical and 9,772,000 at caps.
- `tests/e2e.ts` (Playwright on dist/ at 390x844, mocked API, mock EIP-6963 wallet on anvil). Passed: start enabled by fresh IDLE data with maintenance label; start button on the first screen (bottom 771 px); pattern locks; keyboard (-60 to -40) and pointer drag move the lamp; stale data pauses timer; simulated data stays paused; countdown resume; full 60 s hatch with shell removed; invalid name refused; review shows portrait; JSON download; save to collection.
  Failed: (1) "SVG download equals reviewed portrait" compares against `innerHTML`, whose serialization differs from the source string; the download comes from the same `portraitSVG()` call, but this was not proven in the browser. (2) Mint button did not read "Connect a wallet to mint" and the connect sheet did not open, so wrong chain, switch, rejection, pending, success and duplicate were **not** verified in the browser. Likely cause, not confirmed: `initWallet()` in src/wallet.ts failing in that environment. Contract-level duplicate and revert handling is covered by the anvil test.
- Design probe `taste.mjs`: 13/16 pass (render, layout at 320/390/1440, targets, contrast, casing, tracking, type-sizes, glyphs, slogans, repetition, chrome, motion, share). Failed: eyebrows (the header Connect button counts as a label above the h1 at 390; left as is), copy-budget at 1440 (128 words, because the side panels are on the first screen), type-faces (4 weights; 750 changed to 700 after the probe, not re-run).
- Screenshots at 390 and 1440 checked by eye: product, egg and lamp, and Begin incubation visible at 390.

## Better Interface review
- Accessibility, checked: lamp is a focusable `role=slider` with arrow/Page/Home/End keys and valuetext; Head/Middle/Lower body buttons as an alternative; skip link; visible focus ring; live status regions; connect sheet traps focus, closes on Escape, backdrop and ×, and returns focus; reduced motion respected; inputs labelled with errors. Not done: screen reader session.
- Layout, checked: one column under 980 px, two columns above; stage height capped by viewport. Fixed: `.btn` display overrode `[hidden]` (src/style.css), and the desktop start button sat below the fold.
- Writing: verb-first buttons; signal states named separately ("Resting: 12% maintenance glow" and "Signal missing"); errors say what to do next.
- Typography: one family, 6 tokens, tabular numbers.
- Colors: semantic tokens; probe measured all text at 4.5:1 or better.
- UI: one filled primary action per view, shadows without borders on cards, transitions without `all`.
- Not done: 200% native zoom, RTL, real devices.

## Limitations
- Older v1 saved creatures from the prototype are not imported.
- The shell window and coat are a 2D vertical-band model, not 3D lighting.
- Work units are API units, not verified wheel turns. Caller-supplied art is not proof of a real session.
