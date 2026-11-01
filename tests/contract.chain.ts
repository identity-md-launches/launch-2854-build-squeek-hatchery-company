import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes, type Address } from "viem";
import { startChain } from "./anvil.ts";
import { HATCHERY_ABI } from "../src/wallet.ts";
import { freshSession, develop, palette, lockPattern, validateStatus } from "../src/rules.ts";
import { portraitSVG } from "../src/art.ts";
import { buildTraits, metadataJSON } from "../src/metadata.ts";

test("SqueekHatchery on a local chain: free mint, exact metadata, one mint per session, caps, gas", async () => {
  const c = await startChain();
  try {
    const [alice, bob] = c.accounts;
    const s = freshSession("chain-test-1");
    lockPattern(s, validateStatus({ schemaVersion: 1, measurement: { freshness: "online", provenance: "hardware", coreStatus: "IDLE", rpmMilli: 0, distanceMm: 0, cumulativeWorkUnits: "67023", counterEpoch: "e", observedAt: new Date().toISOString(), receivedAt: new Date().toISOString(), staleAfterSeconds: 120 } }));
    for (const [p, mm] of [[-80, 0], [0, 250000], [80, 500000]] as const) { s.lampPosition = p; develop(s, 20, 120, palette(mm, "2026-11-01")); }
    s.endedAt = "2026-11-01T12:00:00Z";
    const svg = portraitSVG(s), traits = buildTraits(s), sid = keccak256(toBytes(s.id));
    const w = c.wallet(alice);
    const hash = await w.writeContract({ address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", svg, traits, sid], chain: null });
    const receipt = await c.pub.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
    console.log(`mint gas used: ${receipt.gasUsed} for ${svg.length} byte SVG`);
    assert.ok(receipt.gasUsed < 16_777_216n);
    const uri = await c.pub.readContract({ address: c.address, abi: HATCHERY_ABI, functionName: "tokenURI", args: [1n] });
    const meta = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    const local = JSON.parse(metadataJSON(s, "Pip"));
    assert.equal(meta.name, "Pip"); assert.equal(meta.image, local.image); assert.deepEqual(meta.attributes, local.attributes); assert.equal(meta.description, local.description);
    assert.equal(await c.pub.readContract({ address: c.address, abi: HATCHERY_ABI, functionName: "tokenOfSession", args: [sid] }), 1n);
    // Duplicate session from any wallet is refused.
    await assert.rejects(c.pub.simulateContract({ account: bob, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", svg, traits, sid] }), /AlreadyMinted/);
    // Validation.
    const sid2 = keccak256(toBytes("other"));
    await assert.rejects(c.pub.simulateContract({ account: alice, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ['Pi"p', svg, traits, sid2] }), /InvalidName/);
    await assert.rejects(c.pub.simulateContract({ account: alice, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", "<svg " + "x".repeat(12000), traits, sid2] }), /InvalidSvg/);
    await assert.rejects(c.pub.simulateContract({ account: alice, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", svg, "{}", sid2] }), /InvalidTraits/);
    await assert.rejects(c.pub.simulateContract({ account: alice, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", svg, traits, ("0x" + "0".repeat(64)) as `0x${string}`] }), /EmptySession/);
    // Nonpayable: sending ETH reverts.
    await assert.rejects(c.pub.simulateContract({ account: alice, address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["Pip", svg, traits, sid2], value: 1n } as never));
    // Worst case: maximum SVG size stays under the per-transaction gas cap.
    const big = "<svg " + "a".repeat(12000 - 5);
    const h2 = await w.writeContract({ address: c.address, abi: HATCHERY_ABI, functionName: "mint", args: ["x".repeat(30), big, "[" + "1".repeat(1498) + "]", keccak256(toBytes("big"))], chain: null, gas: 16_000_000n });
    const r2 = await c.pub.waitForTransactionReceipt({ hash: h2 });
    console.log(`max-size mint gas used: ${r2.gasUsed}`);
    assert.equal(r2.status, "success"); assert.ok(r2.gasUsed < 16_777_216n);
    assert.equal(await c.pub.readContract({ address: c.address, abi: [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }] as const, functionName: "ownerOf", args: [1n] }).then((a) => a.toLowerCase()), alice.toLowerCase());
  } finally { c.stop(); }
});
