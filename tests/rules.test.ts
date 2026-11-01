import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStatus, workDelta, lampPower, palette, patternAt, patternPreview, freshSession, develop, lockPattern, lampGeometry, positionForRailY, colorAlpha, patternAlpha, STAGE, SignalError, DURATION } from "../src/rules.ts";
import { portraitSVG, animalGroup } from "../src/art.ts";
import { buildTraits, metadataJSON, validName } from "../src/metadata.ts";

const now = Date.parse("2026-11-01T12:00:00Z");
const m = (o: Record<string, unknown> = {}) => ({ schemaVersion: 1, measurement: { freshness: "online", provenance: "hardware", coreStatus: "IDLE", rpmMilli: 0, distanceMm: 0, cumulativeWorkUnits: "67023", counterEpoch: "e1", observedAt: "2026-11-01T11:59:58Z", receivedAt: "2026-11-01T11:59:59Z", staleAfterSeconds: 120, ...o } });

test("accepts fresh hardware data and converts units", () => {
  const r = validateStatus(m({ coreStatus: "ACTIVE", rpmMilli: 60500, distanceMm: 250000, cumulativeWorkUnits: "9007199254740993123" }), now);
  assert.equal(r.rpm, 60.5); assert.equal(r.meters, 250); assert.equal(r.work, 9007199254740993123n); assert.equal(r.utcDate, "2026-11-01");
});
test("rejects missing, stale, simulated, derived, faulted, malformed and replayed data", () => {
  const bad = [null, { schemaVersion: 2 }, { schemaVersion: 1 }, m({ provenance: "simulated" }), m({ provenance: "derived" }), m({ freshness: "stale" }), m({ coreStatus: "COUNTER_FAULT" }), m({ rpmMilli: -1 }), m({ rpmMilli: 1.5 }), m({ cumulativeWorkUnits: "12x" }), m({ cumulativeWorkUnits: 5 }), m({ counterEpoch: "" }), m({ receivedAt: "2026-11-01T11:00:00Z" }), m({ receivedAt: "nope" })];
  for (const b of bad) assert.throws(() => validateStatus(b, now), SignalError);
  const prev = validateStatus(m(), now);
  assert.throws(() => validateStatus(m({ observedAt: "2026-11-01T11:59:00Z" }), now, prev), /replayed/);
  assert.throws(() => validateStatus(m({ cumulativeWorkUnits: "67000" }), now, prev), /backwards/);
  assert.doesNotThrow(() => validateStatus(m({ counterEpoch: "e2", cumulativeWorkUnits: "3" }), now, prev)); // epoch reset is allowed
});
test("work deltas are exact and ignore epoch changes", () => {
  const a = validateStatus(m({ cumulativeWorkUnits: "9007199254740993000" }), now);
  const b = validateStatus(m({ cumulativeWorkUnits: "9007199254740993007" }), now);
  assert.equal(workDelta(a, b), 7n);
  assert.equal(workDelta(a, validateStatus(m({ counterEpoch: "e2", cumulativeWorkUnits: "9" }), now)), 0n);
});
test("lamp power: 12% maintenance at idle, full and capped at 120 RPM", () => {
  assert.equal(lampPower(0), 0.12); assert.equal(lampPower(120), 1); assert.equal(lampPower(500), 1); assert.ok(Math.abs(lampPower(60) - 0.56) < 1e-9);
});
test("5 m colors, pearl and rainbow passages", () => {
  const d = "2026-11-01";
  assert.equal(palette(4999, d).hue, palette(0, d).hue); assert.equal(palette(5000, d).segment, 1);
  for (const mm of [250000, 254999, 750000, 1250000]) assert.equal(palette(mm, d).kind, "pearl");
  for (const mm of [500000, 504999, 1000000]) assert.equal(palette(mm, d).kind, "rainbow");
  for (const mm of [0, 249999, 255000, 505000, 499999]) assert.equal(palette(mm, d).kind, "ordinary");
  assert.notEqual(palette(0, d).hue === palette(0, "2026-11-02").hue && palette(5000, d).hue === palette(5000, "2026-11-02").hue, true);
});
test("50-unit pattern buckets with stars/swirls overrides and no 200-unit windows", () => {
  assert.equal(patternAt(999n).type, "spots".length ? patternAt(999n).type : ""); 
  assert.equal(patternAt(1000n).type, "stars"); assert.equal(patternAt(1049n).type, "stars"); assert.notEqual(patternAt(1050n).type, "stars");
  assert.equal(patternAt(2000n).type, "swirls"); assert.equal(patternAt(2049n).type, "swirls"); assert.notEqual(patternAt(2050n).type, "swirls");
  assert.equal(patternAt(67000n).type, "stars"); assert.equal(patternAt(67049n).type, "stars"); assert.equal(patternAt(68000n).type, "swirls");
  assert.ok(["spots", "patches", "stripes"].includes(patternAt(67050n).type));
  assert.ok(["spots", "patches", "stripes"].includes(patternAt(1100n).type)); // obsolete 200-unit window is gone
  assert.ok(["spots", "patches", "stripes"].includes(patternAt(0n).type) && ["spots", "patches", "stripes"].includes(patternAt(49n).type));
  const p = patternPreview(67023n);
  assert.equal(p.remaining, 27n); assert.equal(p.nextSpecial.type, "swirls"); assert.equal(p.nextSpecial.remaining, 977n);
  assert.equal(patternPreview(67001n).seed, patternPreview(67049n).seed);
  assert.equal(patternPreview(10n ** 30n + 1049n).type, patternAt(10n ** 30n + 1049n).type);
});
test("pattern locks at start; crossing a threshold later never changes it", () => {
  const s = freshSession("a");
  lockPattern(s, validateStatus(m({ cumulativeWorkUnits: "999" }), now));
  const locked = [s.patternType, s.patternSeed];
  develop(s, 5, 0, palette(0, "2026-11-01"), 500n);
  assert.deepEqual([s.patternType, s.patternSeed], locked);
});
test("idle maintenance light develops color and pattern with no new work", () => {
  const s = freshSession("b"); s.lampPosition = 0;
  lockPattern(s, validateStatus(m(), now));
  for (let i = 0; i < 300; i++) develop(s, 0.1, 0, palette(0, "2026-11-01"), 0n);
  const b = s.bands.find((x) => x.y === 220)!;
  assert.ok(colorAlpha(b.dose) > 0.3 && patternAlpha(b.dose) > 0.1, `dose ${b.dose}`);
  assert.equal(s.bands[0].dose, 0); // outside the beam stays untouched
});
test("only the lit region grows; others are preserved; 60 s cap; long exposure stays capped", () => {
  const s = freshSession("c"); s.lampPosition = -80;
  develop(s, 30, 120, palette(0, "2026-11-01"));
  const top = structuredClone(s.bands.slice(0, 4));
  s.lampPosition = 80; develop(s, 100, 120, palette(5000, "2026-11-01"));
  assert.equal(s.elapsed, DURATION); assert.equal(s.regions[0].growth, 1); assert.equal(s.regions[1].growth, 0);
  assert.deepEqual(s.bands.slice(0, 4), top);
  assert.ok(colorAlpha(40) < 0.83);
});
test("re-exposure gradually replaces only that region's color", () => {
  const s = freshSession("d"); const d = "2026-11-01";
  const red = palette(0, d), other = palette(5000, d);
  s.lampPosition = 0; develop(s, 1, 120, red);
  const b = s.bands.find((x) => x.y === 220)!; const first = [...b.rgb];
  develop(s, 0.3, 120, other); const mid = [...b.rgb];
  assert.notDeepEqual(mid, first); assert.notDeepEqual(mid.map(Math.round), other.rgb);
});
test("lamp aims along the egg surface normal and the rail inverse is stable", () => {
  for (let p = -100; p <= 100; p += 10) {
    const g = lampGeometry(p);
    const dx = g.targetX - STAGE.cx, dy = g.targetY - STAGE.cy;
    const tangent = [-dy / STAGE.ry ** 2, dx / STAGE.rx ** 2];
    const dot = (g.sourceX - g.targetX) * tangent[0] + (g.sourceY - g.targetY) * tangent[1];
    assert.ok(Math.abs(dot) < 1e-9);
    assert.ok(g.sourceY > 0 && g.sourceY < 420);
    assert.ok(Math.abs(positionForRailY(g.sourceY) - p) < 0.2);
  }
});
test("portrait, traits and metadata match and fit the contract caps", () => {
  const s = freshSession("1234abcd-0000"); lockPattern(s, validateStatus(m({ cumulativeWorkUnits: "1000" }), now));
  for (const [pos, mm] of [[-80, 0], [0, 250000], [80, 500000]] as const) { s.lampPosition = pos; develop(s, 20, 120, palette(mm, "2026-11-01")); }
  s.endedAt = "2026-11-01T12:01:00Z";
  const svg = portraitSVG(s);
  assert.ok(svg.startsWith("<svg ") && svg.length < 12000, `svg ${svg.length}`);
  assert.ok(svg.includes(animalGroup(s, "p1234abcd").replace(/\n/g, "")));
  assert.ok(buildTraits(s).length < 1500);
  const meta = JSON.parse(metadataJSON(s, "Pip"));
  assert.equal(Buffer.from(meta.image.split(",")[1], "base64").toString(), svg);
  assert.ok(/"Pearl coat","value":"Yes"/.test(buildTraits(s)) && /"Rainbow coat","value":"Yes"/.test(buildTraits(s)));
  assert.ok(validName("Little Pip") && !validName(" Pip") && !validName('Pi"p') && !validName("x".repeat(31)));
});
