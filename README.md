# Squeek Hatchery

Hatch a cozy hamster with light. A real hamster's wheel (the public Squeekchain status API) powers a lamp; you drag the lamp up and down beside a stationary egg for 60 seconds of valid, visible play. The shell turns see-through only under the beam. At hatching the same hamster is revealed, named, reviewed, saved or downloaded, and can optionally be minted as an ERC721 on **Sepolia (11155111) only**. No ERC20, no pool, no mainnet.

Improved from the prototype at github.com/0xvictorvn/squeek-hatchery (main): rules ported to TypeScript, 200-unit special windows deleted, pattern development no longer gated on new work, front-view art rewritten, shell window added, wallet flow moved to @wagmi/core + viem.

## Install, preview, rebuild

Node 22+.

```
npm ci
npm run dev        # local dev server
npm run build      # tsc --noEmit, then vite build into dist/ (relative ./ asset URLs)
npm run preview    # serve the built dist/
npm test           # rule, art and metadata unit tests
npm run contract:test   # forge build + ERC721 tests on a throwaway local anvil chain (needs Foundry)
```

`dist/` is committed and is what gets hosted; rebuild after any source change.

## Layout

- `src/rules.ts` validation, lamp power, palette, pattern schedule, growth, lamp geometry
- `src/art.ts` hamster, patterns, miniatures, shell; `src/metadata.ts` traits and JSON
- `src/wallet.ts` connect sheet data, Sepolia mint; `src/app.ts` UI; `src/style.css` tokens and layout
- `contracts/SqueekHatchery.sol` ERC721; `public/hatchery.config.json` owner-settable contract address
- `tests/` unit, contract (anvil) and end-to-end (Playwright) tests

## Rules implemented

- `GET https://api.squeekchain.com/v1/status`, no key. Accepts only `schemaVersion 1`, `provenance: hardware`, `freshness: online`, `coreStatus` ACTIVE/IDLE, integer fields, digit-string `cumulativeWorkUnits` (BigInt), `receivedAt` within `staleAfterSeconds`. Missing, stale, simulated, derived, COUNTER_FAULT, malformed or replayed (time or counter moving backwards in one epoch) data pauses incubation; nothing is filled in. Resume after a 3 s countdown. Hidden tabs pause and stop polling; no catch-up. Polls every 4 s, 6 s timeout, backoff to 60 s, honours Retry-After.
- RPM = rpmMilli/1000; daily meters = distanceMm/1000. Lamp power 12% at IDLE to 100% at 120 RPM, capped.
- Color depth and pattern visibility both come from local light dose (power x time), capped (82% / 62%), so color deepens without going black and an idle session develops its locked pattern. Work only selects the pattern.
- Hue from UTC date + 5 m segment. Pearl 250-254.999 m, 750 m, ...; rainbow 500 m, 1000 m, ... (5 m each). New light gradually replaces only the lit region's color.
- Patterns: 50-unit buckets cycling spots/patches/stripes; stars at 1000-1049, 3000-3049 ...; swirls at 2000-2049, 4000-4049 .... Family and layout lock at start.
- Waiting times are estimated from the measured work and distance rate of the last 3 minutes, or shown as unknown while the wheel rests.

## NFT and deployment status

The contract stores the raw portrait SVG, the trait JSON and the name; `tokenURI` builds the metadata on-chain, so token, download and hatched animal match. Free, nonpayable mint; one mint per session ID in total; no owner or setters. SVG capped at 12,000 bytes so a mint stays under the 16,777,216 per-transaction gas cap (measured: 8.35M gas typical, 9.77M at the caps on anvil).

**Not deployed.** This run had no authorized, funded Sepolia signer, so no deployment, verification or live mint happened, and no address is configured: the mint button reads "Mint unavailable: contract not configured". To finish:

```
forge create contracts/SqueekHatchery.sol:SqueekHatchery --rpc-url <sepolia rpc> --account <your keystore> --broadcast \
  --verify --etherscan-api-key <key>      # check chain id 11155111 first
```

then put the address in `dist/hatchery.config.json` (and `public/hatchery.config.json`) as `contractAddress`. No rebuild needed. Never commit keys.

## Validation (actual results)

See `VALIDATION.md` for the full record.
