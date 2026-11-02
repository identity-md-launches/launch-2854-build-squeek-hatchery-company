# Squeek Hatchery

NFT minting is not live yet. It will be enabled in a future update.

Local demo with real hamster data. Planned: limited NFT eggs, owner-hatched into personal hamsters shaped by their choices and real data.

This continues the existing Squeek Hatchery site, with its cream/plum incubator and stationary egg. **Demo, wallet integration and upgradeable Sepolia contract TEST SOURCE only. No public deployment was performed or is needed for this delivery.** The static export keeps both contract and proof-service addresses null. The supply cap is undecided and must be selected explicitly at proxy initialization; this repository invents neither a cap nor an admin.

## Install, preview and rebuild

Use Node 24+ and the existing, unchanged package manifest and lockfile.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

The committed `dist/` is the complete static site. Vite uses `base: "./"`; asset URLs are relative, and navigation uses hashes. Serve it over HTTPS (or localhost) for Web Locks, storage and wallet APIs. Rebuild after source or `public/` changes; publish only the resulting export through the existing hosting workflow. No service worker, relay, private key or backend is bundled.

Validation here used an external dependency mirror to preserve the protected repository paths. A normal checkout can use the commands above. `npm run build` runs the typecheck before Vite. The existing dependency graph emits a browser-externalization warning for `node:worker_threads` inside `ox`; tested app flows have no page errors.

## Use the demo

Select **Try demo → Get demo egg → Incubate**. The same local card becomes a hamster after 60 valid, visible seconds. Name it, review it, save it and download its SVG/JSON. **Show coat / Show accessory** changes only the view: every canonical save/export includes the accessory. A new egg is available afterward; one unhatched demo egg is retained at a time.

Progress and the collection use `squeek-hatchery-v3` in this browser. Incubation saves once per active second and on page lifecycle changes; a crash can lose up to the last unsaved second. Reload or history restoration requires an explicit resume and a three-second recovery period. There is no offline growth. An origin-wide Web Lock prevents concurrent incubations in other tabs; unsupported/insecure browsers receive an explanation instead of an unsafe fallback. Demo play does not depend on a wallet, contract or RPC.

Existing v2 portraits remain unchanged in **Legacy portraits**, rendered as images and downloadable. New hamsters have no fur patterns. They carry a stable accessory ID/version and art version 3. Demo cards never become NFTs; NFT eggs start from an onchain claim/transfer and have separate owner/token-specific drafts.

## Light, hardware and accessories

The production site fetches only `https://api.squeekchain.com/v1/status`. It accepts schema v1, hardware provenance, online ACTIVE/IDLE measurements, bounded integer counters and fresh observation/receipt timestamps. Freshness is the smaller of the API limit and 15 seconds. An identical fresh measurement may appear in several 4-second polls: it keeps the current reading and polling cadence, adds no work, and does not restart recovery. Its original timestamps still govern freshness. Older observations and conflicting values at the same observation timestamp are rejected as replayed. Missing, stale, simulated, faulted, malformed and replayed readings pause growth. The last accepted replay baseline survives failures and reloads. Same-epoch work cannot decrease; distance can reset on a new UTC day. Hardware recovery and returning to a visible tab wait three seconds.

The lamp follows RPM from a 12% IDLE maintenance glow to full power at 120 RPM. **Local intensity × active time**, rather than work deltas, develops ears/base fur, cheek/chest fluff, lower coat/pom and local color. The lamp stays perpendicular to the stationary shell. Moving it restores the opacity outside the new soft window; hidden development persists.

Ordinary colors change every 5 m of daily distance. Pearl appears at 250 m then every 500 m; rainbow at 500 m then every 500 m. Each special passage lasts 5 m. The UI shows current/next swatches and remaining meters; there is no color picker.

Work units are API units, **not revolutions**. `floor(work / 50) % 10` selects: neckerchief, bow tie, short open vest, tiny satchel, acorn pendant, daisy ear clip, leaf lapel pin, round glasses, miniature beret, seed brooch. Stardust Crown overrides at 1,000–1,049 and every 2,000 thereafter. Aurora Wing Brooch overrides at 2,000–2,049 and every 2,000 thereafter. Every window lasts 50 units, then ordinary rotation resumes. BigInt preserves exact counters; the accessory locks once at incubation start and appears only after hatch.

**Artwork study · synthetic QA** is explicitly labeled synthetic. It shows same-color low/medium/high fur, mixed regional growth/colors, pearl/rainbow and all 12 accessories. It never supplies production hardware readings or inserts companions into a collection.

## Wallet and NFT test integration

One Connect control supports EIP-6963 browser wallets, phone links for MetaMask/Coinbase/Rabby/Phantom, and Coinbase Smart Wallet through the existing wagmi core connector stack. Connection requests accounts; it never asks for a message signature or transaction. Address, wallet chain and actual Sepolia ETH are read; RPC failure shows unavailable. RPC chain identity is checked before labeled Sepolia balances/contract reads. Wallet changes pause/deselect NFT drafts and trigger fresh holdings/eligibility checks.

`public/hatchery.config.json` (and the exported `dist/hatchery.config.json`) contains:

```json
{
  "chainId": 11155111,
  "contractAddress": null,
  "startBlock": null,
  "proofServiceUrl": null,
  "rpcUrl": "https://ethereum-sepolia-rpc.publicnode.com",
  "explorer": "https://sepolia.etherscan.io"
}
```

`contractAddress` must be the compatible ERC1967 **proxy**, not the implementation. `startBlock` is the proxy's actual deployment block as a decimal string; enumeration reads do not require a log index. No invented deployment values are supplied. Updating the exported JSON and reloading enables a compatible deployment without rebuilding JavaScript. Keep the public export null for this assignment.

**My NFTs** always exposes claim/hatch actions and their disabled reasons. A null contract says **Contract not deployed** and holdings are **unavailable**, never inferred to be zero. A compatible configured contract enables paginated holdings, one free claim per wallet plus gas, egg selection, incubation and review. Hatching additionally requires both an onchain verifier and a real proof service. An absent service explicitly disables hatch. Owner/chain/account are rechecked before signing/submission; the contract enforces ownership again. Rejection/revert restores controls; names are locked through proof/check/signing/receipt states, and a confirmed result is frozen. Success is reported only after a successful receipt and the expected event.

Run `node scripts/check-delivery.mjs` to verify relative export assets, ABI/compiler-source parity, null public config and submission/path budgets. The required artifact allowlist and its explicit 768 KiB budget are in [PATH-BUDGET.md](artifacts/PATH-BUDGET.md).

See [deployment and compiler details](artifacts/DEPLOYMENT.md), [proof-provider protocol and trust model](artifacts/PROOF-PROTOCOL.md), [design system](DESIGN.md) and [actual validation/limits](VALIDATION.md).

## Local checks with mocks

The supplied contract artifacts were compiled using solc 0.8.30, optimizer 200, Prague, OpenZeppelin 5.4.0 from the unchanged lockfile. The full ABI, bytecode, storage layouts and standard JSON compiler input are under `artifacts/contracts/`; the generated frontend ABI is `src/abi.ts`.

With Foundry's `anvil` on PATH:

```sh
node --experimental-strip-types --test tests/contract.chain.ts
```

That test deploys only on a disposable loopback chain with chain ID 11155111, using its unlocked accounts. No fixed key, public contract or funded signer is required. It tests claims, transfers, signed proof bindings/nonces, input/cap limits, callbacks, two-step admin transfer and upgrade storage retention.

To recompile without changing the locked dependency graph, install solc 0.8.30 in an external tool directory and point at its module (or use the existing Foundry build with a locally available compiler):

```sh
SOLC_MODULE=/absolute/path/to/solc/index.js node scripts/compile-contracts.mjs
npm run typecheck
```

`compile-contracts.mjs` expects the normal checkout's `node_modules/@openzeppelin/contracts` from `npm ci`; it also refreshes `src/abi.ts`. The existing `npm run contract:test` uses Foundry then the same local-chain suite against the delivered artifacts; run the solc-js compiler above when regenerating those artifacts.

Install Playwright outside the repository, then use its module/browser path:

```sh
PLAYWRIGHT=/absolute/path/to/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/absolute/path/to/browsers node tests/e2e.mjs
```

This serves the actual export under `/preview/`, intercepts synthetic hardware only inside test browser contexts, and configures the local chain/mock proof service through the runtime JSON response. Null → configured contract → proof service flows use **the same bundle without a rebuild**. A virtual clock advances normal 60-second play; production has no short timer or fake-signal flag. Screenshots/results are written only to disposable `test/scratch/e2e/`.

Regenerate the share image with `PLAYWRIGHT=... PLAYWRIGHT_BROWSERS_PATH=... node scripts/share-card.mjs`, then rebuild. All installs/caches/browser binaries stay outside the submission.

## Source map and attribution

`src/rules.ts` owns pure signal/schedule/growth rules; `src/storage.ts` owns demo cards and Web Locks; `src/art.ts` owns canonical SVGs/accessories; `src/metadata.ts` owns attributes/JSON; `src/nft.ts` owns ABI result/proof hashing; `src/wallet.ts` owns wallet/RPC/transaction guards; `src/app.ts` wires the existing single-page product. `src/style.css` supplies the shared tokens and responsive components.

Design review used Jakub Krehel's Better Interface (MIT, pinned commit 267330e1adfc66a718fb65fa6918c1f06d0a689e) and Paul Bakaus's Impeccable documentation method (Apache-2.0, pinned commit 9d715cc4f5564a990ca8345abfdd5df6dc9b41c8); the resulting design documentation was adapted for this implementation. Notices/licenses are retained in `artifacts/DESIGN-GUIDANCE-LICENSE.txt`. Wallet marks derive from RainbowKit (MIT; `artifacts/WALLET-ICONS-LICENSE.txt`); the Coinbase mark follows the pinned wallet guide. OpenZeppelin's license accompanies the verification sources in `artifacts/OPENZEPPELIN-LICENSE.txt`.
