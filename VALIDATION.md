# Validation — 2026-11-02

This is worker-side evidence for the continued Squeek Hatchery assignment, not an independent behavior/security certification. The deliverable is a static local demo, real wallet integration and upgradeable **TEST SOURCE**. Public contract/proof-service configuration remains null. No public deployment, hosting command, source-verification transaction or external message was sent.

## Scope and actual checks

| Area | Result |
| --- | --- |
| Production build | Pass: `npm run build`, TypeScript then Vite 8.3.5, relative assets |
| Typecheck | Pass: `npm run typecheck` (`tsc --noEmit`) |
| Rules/art/export tests | 12/12 pass (`npm test`) |
| Local contract suite | Pass: one integrated scenario with 43 negative checks, proxy initialization/callback rollback, two-step admin transfer and upgrade storage retention |
| Production-export Chromium suite | 11/11 pass, zero page errors or missing local resources |
| Phone wallet sheet and input QA | Pass: four Open in links + Coinbase Smart Wallet, all local marks loaded; touch, mouse drag, keyboard, Escape/focus return; no page errors |
| Design probe | 15/16 pass; retained header Connect control is the only heuristic warning |
| First 390 px screen | Product and Get demo egg visible; no horizontal scroll |
| Share metadata/image | Title, favicon, description, og:title/og:image present; regenerated PNG inspected at 1200×630 |
| Public deployment | Intentionally unperformed; contract/startBlock/proofServiceUrl are null |

Dependencies were installed from the unchanged lockfile in a temporary source mirror. All dependency/cache/browser directories stayed outside the repository. The final source/public files were copied to that mirror, built, and its clean `dist/` copied back. The production export is delivered beside source and the existing lockfile. The build's existing `ox` dependency emits a `node:worker_threads` browser-externalization warning; application page-error/resource checks passed in the tested flows.

Commands actually run (external tool paths abbreviated):

```sh
npm run typecheck
npm test
SOLC_MODULE=<external-solc-0.8.30-module> node scripts/compile-contracts.mjs
node --experimental-strip-types --test --test-force-exit tests/contract.chain.ts
npm run build
PLAYWRIGHT=<external-playwright> PLAYWRIGHT_BROWSERS_PATH=<external-browsers> node tests/e2e.mjs
IMD_PLAYWRIGHT=<external-playwright> PLAYWRIGHT_BROWSERS_PATH=<external-browsers> \
  node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
PLAYWRIGHT=<external-playwright> PLAYWRIGHT_BROWSERS_PATH=<external-browsers> node scripts/share-card.mjs
node scripts/check-delivery.mjs <fresh-production-export>
git diff --check
```

The phone input/wallet-sheet check ran as a bounded Playwright script in `test/scratch/mobile-wallet.mjs`; results are `test/scratch/mobile-wallet-results.json`. Synthetic data/virtual time exist only in QA browser contexts and the explicitly labeled artwork study. Production has no fake-data fallback, quick-hatch flag or automatic offline timer.

## Contract/security evidence

Compiler: solc **0.8.30+commit.73712a01**, optimizer 200, Prague, viaIR false; locked OpenZeppelin **5.4.0**. Compiler input, ABI/bytecode/storage layouts and generated frontend ABI match the delivered source. Runtime implementation size is **14,550 bytes**, below EIP-170's 24,576 bytes.

On a disposable Anvil chain with chain ID 11155111, tests covered implementation initializer lock; atomic proxy initialization and zero admin/cap rejection; one claim/address; permanent claim state after transfer; recipient's separate claim; owner-only one-time hatch on the same token ID; operator rejection; unset verifier; wrong signer/chain/proxy/token/owner/result hash/expiry; empty signature; nonce replay and atomic rollback on verifier failure; bounded name/SVG/traits/growth/accessory/version inputs; cap exhaustion; nested receiver claim/hatch; rejecting receiver rollback; unauthorized verifier config/upgrades/admin calls; direct implementation upgrade rejection; incompatible implementation rejection; reinitialization; two-step admin acceptance; and actual post-upgrade state retention.

Measured gas on the final local run:

- Claim: **194,344** gas.
- Canonical mixed/special-coat hatch: **10,989,948** gas, **14,472-byte SVG**.
- Maximum accepted 16,000-byte SVG + 1,500-byte attributes payload: **12,656,559** gas, below 16,777,216.
- Unit extreme-art fixtures across all accessories reached **14,425 bytes**; these are sampled bounds, not a proof over every possible floating-point session. Onchain caps remain enforced regardless.

The test upgrade retains owner/pending-admin behavior, cap, verifier, claim flags, owner/enumeration, seeds, hatch flag, consumed nonce and stored companion/metadata. Slot/offset/type/label checks accompany runtime checks. It establishes retention for the supplied function-only test upgrade; arbitrary future upgrades remain an admin trust risk.

TokenURI JSON equals the exported JSON after parsing, and its embedded SVG equals the downloaded canonical SVG exactly. No user/NFT/legacy SVG is inserted as HTML. The live stage is generated from validated numeric session data. Mock verifier/server/signers are test-only, use disposable chain accounts and never enter public config. See `artifacts/PROOF-PROTOCOL.md` for the absent real service and its required independent hardware/session validation.

## Browser scenarios and rendered evidence

The Chromium harness serves the actual export at `/preview/`, exercising relative assets. It intercepts synthetic hardware only inside isolated QA contexts and changes runtime configuration responses without rebuilding the JavaScript. It uses the real local ERC721 proxy/mock verifier and a loopback proof endpoint.

1. First screen/subpath/null contract, real-address display, rejected connect retry, and no signing/transaction on connection.
2. Same local card ID becomes hamster; 30-character name; save/reload; coat-only view; exact SVG/JSON equality; new egg afterward; reflow at 320/390/768/1440.
3. Network/stale/simulated/fault interruptions; repeated backwards-counter replay against retained baseline; recovery delay; synthetic document visibility pause; reload preserves progress without offline growth.
4. Two tabs cannot concurrently incubate or create a duplicate egg.
5. Keyboard lamp and all 21 labeled artwork studies at mobile/desktop widths, including all 12 accessories.
6. Configured-contract holdings and claim; wrong wallet chain/switch; rejection then retry; absent proof service; RPC failure; separate demo collection.
7. NFT incubation/review; bad verifier proof then retry; locked rename/name/mode controls while signing/pending; no pre-receipt success; confirmed frozen name and tokenURI/export parity.
8. Account change pauses/deselects the NFT draft; wallet-connected demo still completes with RPC failure.
9. Transfer of the active egg stops growth, preserves its owner draft, disables further incubation and releases the mode lock.
10. A wrong-chain RPC yields unavailable holdings and disabled actions, then recovers after a valid RPC response.
11. Synthetic pagehide/pageshow restoration preserves progress without automatic growth, then reacquires the lock on Resume; lamp aim chosen before Incubate is retained. Native browser BFCache eligibility was not measured.

A live-export console check observed zero console errors and a valid IDLE hardware signal. It also observed one aborted fetch of the entry URL (`net::ERR_ABORTED`); aborted fetches are excluded from missing-asset checks, and no missing local asset was found.

A separate emulated-phone Chromium session checked the actual mobile connect sheet's four vendor links and Coinbase Smart Wallet label/icons, then touch, mouse and keyboard lamp changes, Escape dismissal, visible focus and no overflow. It did not open native wallet apps or complete a Coinbase passkey flow.

Screenshots inspected: `test/scratch/taste/shots/{390,1440}.png`, the mobile wallet/focused lamp images, `test/scratch/e2e/hamster-result.png`, the synthetic mobile/desktop art studies and the regenerated share image. Scratch evidence is intentionally removed from submission; the reusable harness, worker result record and static art study remain delivered. No physical-device, screen-reader or Safari observation is claimed.

## Better Interface consolidated review

Read/applied the pinned workflow and all six domains. Existing brand/stack were preserved. DESIGN.md records actual final-source tokens, typography, surfaces, components and responsive behavior.

| Domain | Checked coverage and corrections | Unperformed/limits |
| --- | --- | --- |
| Accessibility | Native controls/labels/disabled states; lamp slider keyboard and touch; visible white stage focus; sheet inert background, Tab trap, Escape/focus return; inline name errors and text status independent of color | No screen-reader session, physical-device testing or full accessibility audit |
| Layout | Main action before stage at 390; measured 320/390/768/1440 reflow; complete long names; shrinkable preview/stat grids; bottom sheet; local/NFT mode state boundaries | No browser-native 200% zoom, RTL or localization stress session |
| Writing | Exact requested intro/not-live status; plain Claim/Incubate/Review labels; explicit unavailable holdings and verifier/service reasons; no invented dates/supply or cheat-proof claim | English only; no user study |
| Typography | Six-token source scale, three weights, system stack, wrapping names/addresses/counters, tabular live values, 16 px input | Platform fallback variation; no separate font/zoom audit |
| Colors | Existing semantic palette retained; probe passes measured solid text/background requirements (4.5:1, 3:1 large); exposed/local coat masks reviewed with pearl/rainbow and unlit areas | Not a complete artwork/gradient/alpha contrast certification |
| UI | Loading/empty/error/retry/pending/receipt/frozen states; wallet marks; stationary shell/lamp; saved egg→hamster cards; accessory/coat view and canonical export; reduced motion probe | WebKit runtime unavailable; no native wallet/Coinbase passkey session or Animations-panel 10%-speed review |

Applicable findings fixed in this assignment (source locations refer to the final implementation):

| Finding / impact | Source, observation, correction and recheck |
| --- | --- |
| High: previous mint flow/status conflicted with the new task | `src/app.ts:95`, `src/wallet.ts:65`, runtime config. Exact intro/status, wallet-free egg card, separate My NFTs, null contract/service and explicit disabled reasons replace optional portrait mint. Browser null/configured flows pass. |
| High: progress/collection needed one persistent identity and concurrency control | `src/storage.ts:83`, `src/storage.ts:101`, `src/app.ts:560`. One egg card is updated, active progress is saved, Web Locks serialize tabs; no offline advancement. Save/reload/new egg/two-tab/history-event regressions pass; restored pages pause before reacquiring a lock, and pre-start lamp aim is retained. |
| High: onchain owner/proof/upgrade enforcement absent in previous source | `contracts/SqueekHatchery.sol:53`, `:80`, `:125`. Locked/atomic initialized UUPS source, owner verifier config, bound signed result/nonces, owner-only hatch and two-step admin transfer. Local negative/upgrade/callback tests pass. |
| Medium: anatomy/fur/old patterns did not match the brief | `src/art.ts:71`, `:96`, `src/rules.ts:282`. Union exterior, connected body/head, independent curved regional fur and short attached pom; pattern generation replaced by 12 anatomy-anchored accessories. Labeled study and canonical exports inspected/tested. |
| Medium: SVG filter showed a solid rectangle behind the egg | `src/art.ts:96`, explicit `edgeAlpha` / `edgeColor` / `outline` filter inputs. The reproduced rectangle disappeared in final stage/portrait screenshots. |
| Medium: coat clip reuse dropped local color/shading in an intermediate render | `src/art.ts:96`, concrete silhouette in the clipPath. Restored local color/shading, feathered neighboring exposures; visually checked mixed colors, pearl and seven-color rainbow in the art study. |
| Medium: small pins were unreadable as full-animal miniatures | `src/art.ts:52`, crop-specific accessory viewBoxes. Current/next seed/brooch/clip miniatures now use their shapes' bounds; desktop/mobile study inspected. |
| Medium: hidden pom could protrude outside an opaque shell | `src/app.ts:233`, `eggInterior` stage clip. The animal stays inside the shell before hatch; the same group is unclipped afterward. Hatch regression checks both states; final stage inspected. |
| Medium: ownership loss could leave a paused NFT locking other modes | `src/app.ts:1246`, stop/save/release path on failed ownership refresh. Transfer-during-incubation browser regression checks disabled old egg and return to demo. |
| Medium: asynchronous retry refresh could expose transient controls or leave claim disabled | `src/app.ts:1281`, await eligibility/holdings refresh while locked, then explicitly refresh all controls; freeze confirmed review immediately. Rejection, proof failure/retry and held-signing/receipt regressions rechecked. |
| Medium: discovered wallet metadata/focus needed defensive handling | `src/app.ts:1381`, escaped labels/data-image attributes, local fallback marks, stale-sheet guards and focus return to the current header node. Rejected connect retry plus phone sheet/Escape/icons checks pass. |
| Low: inherited ordinary hue names did not match the swatches | `src/rules.ts:248`, hue-anchor names aligned with their actual HSL colors; added primary-hue and 78-digit work boundary checks to the existing rule suite. |
| Medium: first-screen desktop prose exceeded the probe budget | `src/app.ts:399`, shortened saved/lock notes while preserving required copy. Probe recheck passes copy budget at mobile/desktop. |

Final taste@1: render, layout, targets, contrast, casing, tracking, type sizes/faces, glyphs, slogans, repetition, copy budget, chrome, motion and share pass. The one `eyebrows` warning identifies the required **Connect button in the header** above h1; it is a functioning wallet control, not an introductory kicker. Kept and documented. No unresolved reproduced high-impact design finding remains.

## Limits and submission integrity

- No public NFT contract or real proof service is provided/configured; both are deliberately null for this source-only assignment. A future real verifier/service and explicitly selected admin/cap are necessary before a separately authorized live integration. Signatures cannot prove play; the admin can change all rules by upgrade.
- The supplied managed browser connector failed to launch its required Chrome distribution. Rendered validation used installed Playwright Chromium instead. WebKit was installed/attempted but could not launch due missing system libraries (including GTK/Pango); Safari/WebKit remains unverified.
- Browser storage is local and finite; export a copy. Active progress is saved about once per second, so an abrupt crash can lose the last unsaved second. Web Locks require a current secure-context browser. API/RPC availability and vendor mobile links are external dependencies.
- No screen reader, physical phone/wallet app, Coinbase passkey, native zoom, RTL or arbitrary future upgrade audit was performed. Synthetic QA and local-chain results do not establish production anti-cheat security.
- Protected dependencies/build configuration and `.git/`, `.github/`, `.env` and node_modules paths were not modified. `.gitignore` has only a budgeted allowlist for the required artifacts, documented in `artifacts/PATH-BUDGET.md` (786,432-byte aggregate ceiling).
- The export is a clean copy of the final production build with relative URLs, all runtime assets and null public config. No old hashed chunks, source maps, npm archives, vendored registry, dependency/cache directory or submodule is added.
- Final byte measurements: 1,408,192 bytes across 60 added/modified work files (limit 8,388,608); required artifacts 482,587 bytes (budget 786,432); static export 583,282 bytes across 14 files. `scripts/check-delivery.mjs` checks these ceilings, local asset presence, public/export parity, ABI/compiler-source parity and optional byte-for-byte equality to the fresh production export. The root and artifact validation records are identical.

Completion: Complete for the requested static/demo/local TEST SOURCE scope, with the explicit browser/service limitations above. Nothing was publicly deployed.
