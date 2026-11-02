import "./style.css";
import {
  DURATION,
  ACCESSORIES,
  REGION_NAMES,
  SignalError,
  clamp,
  colorCss,
  colorName,
  develop,
  freshSession,
  lampGeometry,
  lampPower,
  lockAccessory,
  nextSpecialColor,
  palette,
  accessoryPreview,
  positionForRailY,
  regionAt,
  validateStatus,
  workDelta,
  type LampColor,
  type Reading,
  type Session,
} from "./rules.ts";
import {
  animalGroup,
  accessoryMiniature,
  portraitSVG,
  shellLayer,
} from "./art.ts";
import { buildTraits, metadataJSON, validName } from "./metadata.ts";
import { companionOf } from "./nft.ts";
import {
  STORE,
  loadDemo,
  saveDemo,
  selectedCard,
  addDemoEgg,
  withDemoLock,
  validSession,
  type DemoStore,
} from "./storage.ts";
import { formatEther, zeroAddress, type Address } from "viem";
import * as W from "./wallet.ts";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector(s) as T;
const text = (sel: string, v: string) => {
  const e = $(sel);
  if (e && e.textContent !== v) e.textContent = v;
};
const API = "https://api.squeekchain.com/v1/status";
let store: DemoStore = loadDemo();
let mode: "demo" | "nft" = "demo";
let session = selectedCard(store)?.session || freshSession();
let phase: "ready" | "running" | "hatched" = session.endedAt
  ? "hatched"
  : "ready";
let hasEgg = !!selectedCard(store),
  finalName = selectedCard(store)?.name || "",
  reviewing = phase === "hatched",
  showAccessory = true;
let nftSelection: { id: string; owner: Address; key: string } | null = null;
let frozen: { svg: string; metadata: string; name: string } | null = null;
let reading: Reading | null = null,
  replayBaseline: Reading | null = null;
let lastOk = 0,
  signalNote = "Connecting to the wheel",
  signalReason: string | null = null;
let pollDelay = 4000,
  pollTimer = 0,
  polling = false,
  resumeAt: number | null = null,
  lastFrame = 0,
  lastAnimal = 0,
  lastPersist = 0,
  pendingWork = 0n;
let currentColor: LampColor | null = null,
  lit = false,
  releaseLock: (() => void) | null = null,
  busy = false,
  walletReady = false;
let nftState: { count: bigint; tokens: W.Holding[]; next: bigint } | null =
  null;
let claimReason = "Contract not deployed",
  hatchReason = "Contract not deployed",
  walletEpoch = 0,
  holdingsEpoch = 0;
let nftGuardAt = 0,
  nftOwnershipValid = false,
  nftGuardPending = false;
const logo = `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><ellipse cx="16" cy="17" rx="11" ry="13" fill="#f5e3c8" stroke="#a8492a" stroke-width="2"/><circle cx="12.5" cy="16" r="1.6" fill="#3b2a24"/><circle cx="19.5" cy="16" r="1.6" fill="#3b2a24"/><path d="M15 19.5h2l-1 1.2z" fill="#a8492a"/></svg>`;
$("#app").innerHTML =
  `<a class="skip" href="#incubator">Skip to the incubator</a>
<header class="top"><a class="brand" href="#demo">${logo}<span>Squeek Hatchery</span></a><nav aria-label="Site"><a href="#how">How it works</a><a href="#collection-title">Collection</a></nav><div id="wallet-slot"><button class="btn small" id="w-connect">Connect</button></div></header>
<main><section class="hero"><h1 id="title">Hatch a hamster with light</h1><p class="lead">Local demo with real hamster data. Planned: limited NFT eggs, owner-hatched into personal hamsters shaped by their choices and real data.</p><p class="launch-note">NFT minting is not live yet. It will be enabled in a future update.</p></section>
<div class="mode-tabs" role="group" aria-label="Hatchery mode"><button class="btn small" id="tab-demo" aria-pressed="true">Try demo</button><button class="btn small" id="tab-nft" aria-pressed="false">My NFTs</button></div>
<p id="app-note" class="note feedback" role="status"></p>
<section id="nft-panel" class="card nft-panel" hidden aria-labelledby="nft-title"><h2 id="nft-title">My NFTs · Sepolia</h2><p id="wallet-facts" class="note">Connect to read your address, network and Sepolia ETH.</p><p id="contract-state">Contract not deployed</p><p id="nft-status" class="note" role="status">Holdings unavailable: contract not deployed.</p><div class="row"><button class="btn" id="refresh-nft">Refresh holdings</button><button class="btn primary" id="claim" disabled>Claim egg</button><button class="btn" id="nft-hatch" disabled>Hatch selected egg</button></div><p class="note" id="claim-reason">Contract not deployed</p><p class="note" id="hatch-reason">Contract not deployed</p><p class="note">Claim once per wallet, free plus Sepolia gas. Transfers keep the original claim used. Only the current owner can hatch once. The admin can upgrade the rules and replace the verifier.</p><p id="tx-status" class="note feedback" role="status" aria-live="polite"></p><div class="grid" id="nft-holdings"></div><button class="btn" id="more-nfts" hidden>Load more NFTs</button></section>
<div class="layout" id="demo-layout"><section id="incubator" class="incubator" aria-labelledby="incubator-title"><h2 id="incubator-title" class="sr-only">Incubator</h2><div class="actions"><button class="btn primary" id="get-egg">Get demo egg</button><button class="btn primary" id="start" hidden>Incubate</button><button class="btn" id="again" hidden>Get new demo egg</button></div><p class="note" id="start-note">Wallet-free. Saved in this browser.</p><div class="stage-bar"><p id="signal-pill" class="pill" role="status">Connecting to the wheel</p><p class="timer"><span class="sr-only">Incubation time left </span><strong id="timer">1:00</strong></p></div>
      <div class="stage" id="stage">
        <svg id="stage-svg" viewBox="0 0 400 420" aria-hidden="true">
          <defs><clipPath id="eggInterior"><ellipse cx="200" cy="215" rx="118" ry="152"/></clipPath><radialGradient id="glow"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".9"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></radialGradient>
          <linearGradient id="beamgrad" x1="1" x2="0"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".75"/><stop offset="1" stop-color="var(--lamp)" stop-opacity=".2"/></linearGradient></defs>
          <ellipse cx="200" cy="380" rx="150" ry="22" fill="#4a3742"/>
          <ellipse cx="200" cy="372" rx="128" ry="16" fill="#6b4f5a"/>
          <g id="animal"></g>
          <g id="shell"></g>
          <g id="beam-layer"><polygon id="beam" fill="url(#beamgrad)"/><ellipse id="spot" rx="44" ry="30" fill="url(#glow)"/></g>
          <line x1="372" y1="40" x2="372" y2="384" stroke="#6b5560" stroke-width="4" stroke-linecap="round"/>
          <g id="lamp-art"><g id="lamp-rot"><rect x="-14" y="-17" width="30" height="34" rx="9" fill="#e9d4b6" stroke="#8a6b55" stroke-width="2"/><path d="M-14-13h-8a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h8z" fill="#f6e6cc" stroke="#8a6b55" stroke-width="2"/><circle id="bulb" cx="-24" cy="0" r="7"/></g></g>
        </svg>
        <div id="lamp" class="lamp-handle" role="slider" tabindex="0" aria-label="Lamp height" aria-orientation="vertical" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="-60"></div>
        <div id="rail-hit" class="rail-hit" aria-hidden="true"></div>
        <div id="pause" class="pause" hidden><strong id="pause-title">Paused</strong><span id="pause-copy"></span></div>
      </div>

<p class="hint" id="hint">Drag the lamp on the right, or use arrow keys.</p><div class="regions" role="group" aria-label="Aim the lamp at"><button data-pos="-70">Head</button><button data-pos="0">Middle</button><button data-pos="70">Lower body</button></div><div class="progress" aria-hidden="true"><span id="progress"></span></div></section>
<div class="panels"><section class="card"><h2>Wheel signal</h2><p id="signal-state" class="state">Connecting</p><dl class="stats"><div><dt>Wheel speed</dt><dd id="rpm">Unavailable</dd></div><div><dt>Lamp power</dt><dd id="power">Unavailable</dd></div><div><dt>Distance today</dt><dd id="meters">Unavailable</dd></div><div><dt>Work units</dt><dd id="work">Unavailable</dd></div></dl><p id="signal-age" class="note">Real hardware only. API work units are not revolutions.</p></section>
<section class="card"><h2>Lamp color</h2><div class="pair"><figure><span class="swatch off" id="sw-now"></span><figcaption><span class="label">Now</span><span id="c-now">Unavailable</span></figcaption></figure><figure><span class="swatch off" id="sw-next"></span><figcaption><span class="label">Next</span><span id="c-next">Unavailable</span></figcaption></figure></div><p class="note" id="c-remaining">Ordinary colors change every 5 m.</p><p class="note" id="c-special">Pearl at 250 m, rainbow at 500 m. Each passage lasts 5 m.</p></section>
<section class="card"><h2>Accessory</h2><p class="locked note" id="locked">Accessory locks when incubation starts.</p><div class="pair"><figure><span class="mini off" id="a-now"></span><figcaption><span class="label">Now</span><span id="a-now-name">Unavailable</span></figcaption></figure><figure><span class="mini off" id="a-next"></span><figcaption><span class="label">Next</span><span id="a-next-name">Unavailable</span></figcaption></figure></div><p class="note" id="a-remaining">Every window lasts 50 work units.</p><p class="note" id="a-special">Crown at 1,000 units; brooch at 2,000. Each repeats every 2,000.</p></section>
<section class="card"><h2>Growing traits</h2><ul class="traits">${REGION_NAMES.map((n, i) => `<li><span>${n}</span><span class="meter"><span id="m${i}"></span></span><strong id="t${i}">0%</strong></li>`).join("")}</ul><p class="note">Head: ears and base fur. Middle: cheeks and chest. Lower: coat and a tiny pom. Only local light intensity and time develop traits.</p></section></div></div>
<section id="result" class="result card" hidden aria-labelledby="result-title"><h2 id="result-title">Your hamster has hatched</h2><div class="result-grid"><div class="portrait"><img id="portrait" width="400" height="420" alt="Your hamster portrait"><button id="toggle-accessory" class="btn small">Show coat</button><p class="note">View only. Saved portraits always include the accessory.</p></div><div class="result-body"><form id="name-form" novalidate><label for="name">Name</label><input id="name" name="name" maxlength="30" autocomplete="off" aria-describedby="name-help" required><p class="note" id="name-help">Up to 30 letters, numbers, spaces and . , ' -</p><button class="btn primary" id="review" type="submit">Review hamster</button></form><div id="review-panel" hidden><p class="named"><strong id="final-name" tabindex="-1"></strong><button id="rename" class="link">Change name</button></p><ul class="trait-list" id="trait-list"></ul><div class="row"><button id="save" class="btn primary">Save to this browser</button><button id="dl-svg" class="btn">Download SVG</button><button id="dl-json" class="btn">Download JSON</button></div><div class="mint-box" id="nft-submit" hidden><h3>Hatch this NFT</h3><p class="note">The same token ID becomes your hamster after a confirmed transaction. Gas applies. A configured verifier and a session proof service must accept this exact result.</p><button id="hatch-submit" class="btn" disabled>Hatch on Sepolia</button><p class="note" id="submit-reason"></p></div></div></div></div></section>
<section id="demo-collection" class="collection"><h2 id="collection-title">Demo collection</h2><p class="note">Local cards only. An egg becomes a hamster on the same card. Download a copy to keep it elsewhere.</p><div class="grid" id="collection"></div><div id="legacy"></div></section>
<section id="how" class="how"><h2>How it works</h2><ul><li><strong>Real data.</strong> Incubation counts 60 valid seconds in a visible tab. A missing, stale, faulted, simulated or replayed reading pauses it. Recovery waits 3 seconds; there is no offline growth.</li><li><strong>Aim the light.</strong> The egg stays still. The lamp points perpendicular to the shell. Only the lit area becomes transparent; hidden growth stays.</li><li><strong>Color follows distance.</strong> Ordinary light changes every 5 m. Pearl starts at 250 m then every 500 m. Rainbow starts at 500 m then every 500 m. Special passages last 5 m.</li><li><strong>Accessories follow work.</strong> Ten designs rotate every 50 API work units. Stardust Crown overrides at 1,000–1,049 then every 2,000; Aurora Wing Brooch at 2,000–2,049 then every 2,000. The accessory locks when incubation starts and appears after hatching.</li><li><strong>Demo and NFTs are separate.</strong> Demo needs no wallet or RPC. NFT claims and hatches are test source only. One claim per wallet is not an anti-Sybil guarantee. Seeds are predictable; signatures alone cannot prove play.</li></ul></section>
<details class="qa"><summary>Artwork study · synthetic QA</summary><p class="note">Synthetic fixtures for visual comparison only. These are not live readings or saved companions.</p><div id="qa-art" class="qa-grid"></div></details>
</main><footer class="foot">Community project using the public Squeekchain status API. Sepolia test source only. No public deployment, token sale, clothing NFTs or shop.</footer><div id="sheet-root"></div>`;

const stage = $("#stage"),
  lamp = $("#lamp");
// ---------- Lamp input ----------
function aim(pos: number) {
  if (phase === "hatched") return;
  session.lampPosition = clamp(Math.round(pos * 10) / 10, -100, 100);
  drawLamp();
}
function railYFromEvent(e: PointerEvent) {
  const r = stage.getBoundingClientRect();
  return ((e.clientY - r.top) / r.height) * 420;
}
let dragging = false;
for (const el of [lamp, $("#rail-hit")]) {
  el.addEventListener("pointerdown", (e) => {
    if (phase === "hatched") return;
    e.preventDefault();
    dragging = true;
    el.setPointerCapture(e.pointerId);
    aim(positionForRailY(railYFromEvent(e)));
    lamp.focus({ preventScroll: true });
  });
  el.addEventListener("pointermove", (e) => {
    if (dragging) aim(positionForRailY(railYFromEvent(e)));
  });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"])
    el.addEventListener(t, () => (dragging = false));
}
lamp.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 20 : 5;
  const map: Record<string, number> = {
    ArrowUp: -step,
    ArrowLeft: -step,
    ArrowDown: step,
    ArrowRight: step,
    PageUp: -25,
    PageDown: 25,
  };
  if (e.key in map) {
    e.preventDefault();
    aim(session.lampPosition + map[e.key]);
  } else if (e.key === "Home") {
    e.preventDefault();
    aim(-100);
  } else if (e.key === "End") {
    e.preventDefault();
    aim(100);
  }
});
document
  .querySelectorAll<HTMLButtonElement>("[data-pos]")
  .forEach((b) =>
    b.addEventListener("click", () => aim(Number(b.dataset.pos))),
  );

// ---------- Stage drawing ----------

function drawLamp() {
  const g = lampGeometry(session.lampPosition);
  $("#lamp-art").setAttribute(
    "transform",
    `translate(${g.sourceX} ${g.sourceY})`,
  );
  $("#lamp-rot").setAttribute(
    "transform",
    `rotate(${(g.angle - 180).toFixed(1)})`,
  );
  lamp.style.top = `${(g.sourceY / 420) * 100}%`;
  lamp.style.left = `${(g.sourceX / 400) * 100}%`;
  const region = regionAt(session.lampPosition);
  lamp.setAttribute("aria-valuenow", String(Math.round(session.lampPosition)));
  lamp.setAttribute(
    "aria-valuetext",
    `Lighting the ${["head", "middle", "lower body"][region]}`,
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-pos]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(regionAt(Number(b.dataset.pos)) === region),
      ),
    );
  // Beam from the bulb to the surface point, widening toward the egg.
  const bx = g.sourceX + Math.cos((g.angle * Math.PI) / 180) * 26,
    by = g.sourceY + Math.sin((g.angle * Math.PI) / 180) * 26;
  const px = -Math.sin((g.angle * Math.PI) / 180),
    py = Math.cos((g.angle * Math.PI) / 180);
  const pts = [
    [bx + px * 6, by + py * 6],
    [g.targetX + px * 34, g.targetY + py * 34],
    [g.targetX - px * 34, g.targetY - py * 34],
    [bx - px * 6, by - py * 6],
  ];
  $("#beam").setAttribute(
    "points",
    pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "),
  );
  $("#spot").setAttribute("cx", (g.targetX - 40).toFixed(1));
  $("#spot").setAttribute("cy", g.targetY.toFixed(1));
  $("#shell").innerHTML =
    phase === "hatched" ? "" : shellLayer(g.targetX, g.targetY, lit);
}

function drawAnimal() {
  $("#animal").setAttribute(
    "clip-path",
    phase === "hatched" ? "none" : "url(#eggInterior)",
  );
  $("#animal").innerHTML = animalGroup(session, "s");
}

// Fresh hardware polling; the replay baseline is never cleared by an interruption.
try {
  const b = JSON.parse(
    localStorage.getItem("squeek-signal-baseline-v3") || "null",
  );
  if (
    b &&
    typeof b.work === "string" &&
    /^\d{1,78}$/.test(b.work) &&
    Number.isFinite(b.observedAt) &&
    typeof b.counterEpoch === "string"
  )
    replayBaseline = { ...b, work: BigInt(b.work) };
} catch {
  /* no baseline */
}
async function poll() {
  clearTimeout(pollTimer);
  if (document.hidden || polling) return;
  polling = true;
  try {
    const response = await fetch(API, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new SignalError(
        "missing",
        `Status API answered ${response.status}`,
      );
    const next = validateStatus(
      await response.json(),
      Date.now(),
      replayBaseline,
    );
    if (next !== replayBaseline) {
      if (phase === "running" && !document.hidden)
        pendingWork += workDelta(reading, next);
      replayBaseline = next;
      pollDelay = 4000;
      try {
        localStorage.setItem(
          "squeek-signal-baseline-v3",
          JSON.stringify({ ...next, work: next.work.toString() }),
        );
      } catch {
        /* data validation still works in memory */
      }
    }
    reading = next;
    lastOk = Date.now();
    signalReason = null;
  } catch (e) {
    reading = null;
    resumeAt = null;
    pendingWork = 0n;
    signalReason = e instanceof SignalError ? e.reason : "network";
    signalNote =
      e instanceof SignalError
        ? e.message
        : "The status API could not be reached";
    pollDelay = clamp(pollDelay * 1.6, 4000, 60000);
  } finally {
    polling = false;
    if (!document.hidden) pollTimer = window.setTimeout(poll, pollDelay);
  }
}
function liveReading() {
  if (!reading) return null;
  const now = Date.now();
  return now - lastOk <= 15000 &&
    now - reading.received <=
      Math.min(15000, reading.staleAfterSeconds * 1000) &&
    now - reading.observedAt <=
      Math.min(15000, reading.staleAfterSeconds * 1000)
    ? reading
    : null;
}
function persistSession() {
  try {
    if (mode === "demo" && hasEgg) {
      const card = selectedCard(store);
      if (card) {
        card.session = session;
        saveDemo(store);
      }
    } else if (nftSelection)
      localStorage.setItem(
        nftSelection.key,
        JSON.stringify({ session, name: finalName, frozen }),
      );
  } catch {
    note(
      "Browser storage is full or unavailable. Keep this tab open and download your result.",
    );
  }
}
function note(message: string) {
  text("#app-note", message);
}
function frame(t: number) {
  const dt = lastFrame ? Math.min(0.25, (t - lastFrame) / 1000) : 0;
  lastFrame = t;
  const m = liveReading();
  currentColor = m ? palette(m.distanceMm, m.utcDate) : null;
  let paused = false;
  if (phase === "running") {
    if (!m || document.hidden || (mode === "nft" && !nftOwnershipValid)) {
      paused = true;
      resumeAt = null;
      pendingWork = 0n;
    } else if (resumeAt === null) {
      resumeAt = t + 3000;
      paused = true;
    } else if (t < resumeAt) paused = true;
    else {
      const done = develop(session, dt, m.rpm, currentColor!, pendingWork);
      pendingWork = 0n;
      if (done) hatch();
    }
    if (t - lastPersist > 1000) {
      persistSession();
      lastPersist = t;
    }
  }
  if (
    mode === "nft" &&
    nftSelection &&
    phase === "running" &&
    t - nftGuardAt > 5000 &&
    !nftGuardPending
  ) {
    nftGuardAt = t;
    void guardNft();
  }
  const wasLit = lit;
  lit = !!m && hasEgg && phase !== "hatched" && !document.hidden;
  document.documentElement.style.setProperty(
    "--lamp",
    currentColor
      ? currentColor.kind === "rainbow"
        ? "#f6d2e4"
        : currentColor.kind === "pearl"
          ? "#f4e2f0"
          : `hsl(${currentColor.hue} 85% 78%)`
      : "#777",
  );
  $("#beam-layer").style.opacity = lit
    ? String(0.25 + 0.75 * lampPower(m!.rpm))
    : "0";
  $("#bulb").setAttribute("fill", lit ? "var(--lamp)" : "#8d7d78");
  if (wasLit !== lit || t - lastAnimal > 160) drawLamp();
  if (t - lastAnimal > 160) {
    drawAnimal();
    renderPanels(m, paused, t);
    lastAnimal = t;
  }
  requestAnimationFrame(frame);
}
const number = (n: bigint | number) => n.toLocaleString("en-US");
function renderPanels(m: Reading | null, paused: boolean, t: number) {
  const resting = m?.coreStatus === "IDLE";
  const state = !m
    ? "Signal unavailable"
    : resting
      ? "Resting · 12% glow"
      : `Running · ${Math.round(lampPower(m.rpm) * 100)}% power`;
  text("#signal-pill", state);
  $("#signal-pill").dataset.state = !m ? "missing" : resting ? "rest" : "run";
  text(
    "#signal-state",
    m
      ? "Fresh hardware reading"
      : signalReason
        ? signalNote
        : "Connecting to real hardware",
  );
  text("#rpm", m ? `${number(m.rpm)} RPM` : "Unavailable");
  text("#power", m ? `${Math.round(lampPower(m.rpm) * 100)}%` : "Unavailable");
  text("#meters", m ? `${number(m.meters)} m` : "Unavailable");
  text("#work", m ? number(m.work) : "Unavailable");
  text(
    "#signal-age",
    m
      ? `Observed ${new Date(m.observedAt).toLocaleTimeString("en-US")}. API work units are not revolutions.`
      : "Missing, stale, simulated, faulted or replayed data pauses growth. Last accepted baseline is kept.",
  );
  if (m) {
    const c = palette(m.distanceMm, m.utcDate),
      next = palette((c.segment + 1) * 5000, m.utcDate),
      special = nextSpecialColor(m.distanceMm);
    for (const [sel, col] of [
      ["#sw-now", c],
      ["#sw-next", next],
    ] as const) {
      $(sel).classList.remove("off");
      $(sel).style.background = colorCss(col);
    }
    text("#c-now", colorName(c));
    text("#c-next", colorName(next));
    text(
      "#c-remaining",
      `${number(Number(c.remainingMeters.toFixed(3)))} m until the next color.`,
    );
    text(
      "#c-special",
      `${special.kind === "pearl" ? "Pearl" : "Rainbow"} in ${number(Number(special.meters.toFixed(3)))} m. Passages last 5 m.`,
    );
    const a = accessoryPreview(m.work);
    for (const [sel, id] of [
      ["#a-now", a.id],
      ["#a-next", a.next],
    ] as const) {
      const el = $(sel);
      el.classList.remove("off");
      if (el.dataset.id !== String(id)) {
        el.dataset.id = String(id);
        el.innerHTML = accessoryMiniature(id);
      }
    }
    text("#a-now-name", ACCESSORIES[a.id]);
    text("#a-next-name", ACCESSORIES[a.next]);
    text(
      "#a-remaining",
      `${number(a.remaining)} work units until the next accessory.`,
    );
    text(
      "#a-special",
      `${ACCESSORIES[a.nextSpecial.id]} in ${number(a.nextSpecial.remaining)} units. Each window lasts 50 units.`,
    );
  } else {
    for (const id of ["sw-now", "sw-next", "a-now", "a-next"]) {
      const e = $("#" + id);
      e.classList.add("off");
      e.style.background = "";
      if (id.startsWith("a-")) {
        e.replaceChildren();
        delete e.dataset.id;
      }
    }
    for (const id of ["c-now", "c-next", "a-now-name", "a-next-name"])
      text("#" + id, "Unavailable");
    text("#c-remaining", "Waiting for fresh hardware distance.");
    text("#a-remaining", "Waiting for fresh hardware work units.");
    text(
      "#c-special",
      "Pearl at 250 m, rainbow at 500 m. Each passage lasts 5 m.",
    );
    text(
      "#a-special",
      "Crown at 1,000 units; brooch at 2,000. Each repeats every 2,000.",
    );
  }
  text(
    "#locked",
    session.accessorySource
      ? `Locked: ${ACCESSORIES[session.accessoryId]} at ${number(BigInt(session.accessorySource.cumulativeWorkUnits))} units. Appears after hatch.`
      : "Accessory locks when incubation starts.",
  );
  session.regions.forEach((r, i) => {
    text("#t" + i, `${Math.round(r.growth * 100)}%`);
    $("#m" + i).style.width = `${r.growth * 100}%`;
  });
  const left = Math.ceil(Math.max(0, DURATION - session.elapsed));
  text(
    "#timer",
    `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
  );
  $("#progress").style.width = `${(session.elapsed / 60) * 100}%`;
  $("#get-egg").hidden = mode !== "demo" || hasEgg;
  $<HTMLButtonElement>("#get-egg").disabled = busy;
  $("#start").hidden = !hasEgg || phase !== "ready";
  $<HTMLButtonElement>("#start").disabled =
    !m || busy || (mode === "nft" && !nftOwnershipValid);
  text(
    "#start",
    session.elapsed > 0 ? "Resume incubation" : "Incubate · 60 active seconds",
  );
  $("#again").hidden = mode !== "demo" || phase !== "hatched";
  $<HTMLButtonElement>("#again").disabled = busy;
  text(
    "#start-note",
    !hasEgg
      ? "Wallet-free. Saved in this browser."
      : phase === "running"
        ? "Progress is saved. Only valid, visible play counts."
        : phase === "hatched"
          ? "The same card is now your hamster."
          : !m
            ? "Waiting for fresh hardware data. Your egg is kept."
            : session.elapsed > 0
              ? "Saved progress is kept. Recovery waits 3 seconds."
              : "Aim the lamp, then incubate. No offline growth.",
  );
  $("#pause").hidden = !(phase === "running" && paused);
  if (paused) {
    text(
      "#pause-title",
      m && resumeAt !== null
        ? `Resuming in ${Math.max(1, Math.ceil((resumeAt - t) / 1000))}`
        : "Paused",
    );
    text(
      "#pause-copy",
      mode === "nft" && !nftOwnershipValid
        ? "Checking egg ownership."
        : m
          ? "Fresh hardware data is back."
          : "Waiting for a fresh hardware reading.",
    );
  }
  text(
    "#hint",
    phase === "hatched"
      ? "The same hamster that grew inside your egg."
      : phase === "running" && paused
        ? "Your progress is kept while paused."
        : "Drag the lamp on the right, or use arrow keys.",
  );
}

async function getEgg() {
  if (busy || phase === "running" || mode !== "demo") return;
  try {
    await withDemoLock(() => {
      store = loadDemo();
      const card = addDemoEgg(store);
      saveDemo(store);
      session = card.session;
      hasEgg = true;
      phase = "ready";
      finalName = "";
      frozen = null;
      reviewing = false;
      showAccessory = true;
      $("#result").hidden = true;
      $("#stage").classList.remove("hatched");
      renderCollection();
      drawLamp();
      drawAnimal();
    });
    note(
      "Demo egg saved. Aim the lamp and incubate when hardware data is fresh.",
    );
  } catch (e) {
    note(W.errorMessage(e));
  }
}
$("#get-egg").addEventListener("click", getEgg);
$("#again").addEventListener("click", getEgg);
$("#start").addEventListener("click", async () => {
  if (phase !== "ready" || !hasEgg || busy || !liveReading()) return;
  try {
    await withDemoLock(async () => {
      let aimedPosition = session.lampPosition;
      if (mode === "demo") {
        store = loadDemo();
        const card = selectedCard(store);
        if (!card || card.kind !== "egg")
          throw new Error("This card already hatched. Refresh the collection.");
        session = card.session;
      } else if (nftSelection) {
        const selection = nftSelection;
        await W.assertOwner(BigInt(selection.id), selection.owner);
        if (
          mode !== "nft" ||
          nftSelection !== selection ||
          phase !== "ready" ||
          busy
        )
          return;
        aimedPosition = session.lampPosition;
        try {
          const draft = JSON.parse(
            localStorage.getItem(selection.key) || "null",
          );
          if (draft && validSession(draft.session)) {
            session = draft.session;
            if (session.endedAt) {
              phase = "hatched";
              finalName = validName(draft.name || "") ? draft.name : "";
              reviewing = !!finalName;
              frozen = draft.frozen || null;
              renderMode();
              note(
                "This egg's incubation is ready. Review the existing result.",
              );
              return;
            }
          }
        } catch {
          /* keep the validated current draft if storage is unavailable */
        }
      } else return;
      session.lampPosition = aimedPosition;
      const m = liveReading();
      if (!m || document.hidden) return;
      const recovering = !!session.startedAt;
      lockAccessory(session, m);
      session.startedAt ||= new Date().toISOString();
      phase = "running";
      resumeAt = recovering ? null : performance.now();
      lastFrame = 0;
      pendingWork = 0n;
      persistSession();
      renderCollection();
      lamp.focus();
      note("");
      await new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
    });
  } catch (e) {
    note(W.errorMessage(e));
  }
});
function hatch() {
  phase = "hatched";
  session.endedAt = new Date().toISOString();
  $("#stage").classList.add("hatched");
  if (mode === "demo") {
    const card = selectedCard(store);
    if (card) {
      card.kind = "hamster";
      card.name = "Unnamed hamster";
      card.session = session;
    }
  }
  finalName = "";
  reviewing = false;
  showAccessory = true;
  persistSession();
  releaseLock?.();
  releaseLock = null;
  renderCollection();
  renderResult();
  drawLamp();
  drawAnimal();
  $("#result").scrollIntoView({ block: "start", behavior: "auto" });
  $("#name").focus({ preventScroll: true });
}
function imageSource(svg: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function currentResult() {
  return (
    frozen || {
      svg: portraitSVG(session),
      metadata: metadataJSON(session, finalName),
      name: finalName,
    }
  );
}
function renderResult() {
  const on = phase === "hatched" && hasEgg;
  $("#result").hidden = !on;
  if (!on) return;
  text(
    "#result-title",
    mode === "nft"
      ? `Review NFT egg #${nftSelection?.id}`
      : "Your demo hamster has hatched",
  );
  $<HTMLImageElement>("#portrait").src = imageSource(
    showAccessory ? currentResult().svg : portraitSVG(session, false),
  );
  text("#toggle-accessory", showAccessory ? "Show coat" : "Show accessory");
  $("#name-form").hidden = reviewing;
  $("#review-panel").hidden = !reviewing;
  $("#nft-submit").hidden = mode !== "nft";
  $<HTMLInputElement>("#name").value = finalName;
  text("#final-name", currentResult().name);
  $("#rename").hidden = !!frozen;
  for (const id of ["rename", "name", "review", "toggle-accessory"])
    $<HTMLButtonElement>("#" + id).disabled = busy;
  $("#trait-list").replaceChildren();
  if (reviewing) {
    for (const a of JSON.parse(buildTraits(session))) {
      const li = document.createElement("li"),
        label = document.createElement("span"),
        value = document.createElement("strong");
      label.textContent = a.trait_type;
      value.textContent = String(a.value);
      li.append(label, value);
      $("#trait-list").append(li);
    }
  }
  updateNftControls();
}
$("#name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy || frozen) return;
  const input = $<HTMLInputElement>("#name"),
    name = input.value.trim().replace(/\s+/g, " ");
  if (!validName(name)) {
    input.setAttribute("aria-invalid", "true");
    text("#name-help", "Use 1 to 30 letters, numbers, spaces and . , ' -");
    input.focus();
    return;
  }
  input.removeAttribute("aria-invalid");
  finalName = name;
  reviewing = true;
  renderResult();
  $("#final-name").focus();
});
$("#rename").addEventListener("click", () => {
  if (busy || frozen) return;
  reviewing = false;
  renderResult();
  $("#name").focus();
});
$("#toggle-accessory").addEventListener("click", () => {
  showAccessory = !showAccessory;
  renderResult();
});
function download(data: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fileBase() {
  return (currentResult().name || "hamster")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
$("#dl-svg").addEventListener("click", () =>
  download(currentResult().svg, "image/svg+xml", fileBase() + ".svg"),
);
$("#dl-json").addEventListener("click", () =>
  download(currentResult().metadata, "application/json", fileBase() + ".json"),
);
$("#save").addEventListener("click", () => {
  if (!reviewing) return;
  try {
    if (mode === "demo") {
      const card = selectedCard(store);
      if (card) {
        card.name = finalName;
        card.svg = currentResult().svg;
        card.metadata = currentResult().metadata;
        card.session = session;
        saveDemo(store);
        renderCollection();
      }
    } else persistSession();
    text("#save", "Saved to this browser");
  } catch {
    note("Browser storage unavailable. Download your portrait to keep it.");
  }
});
function renderCollection() {
  const root = $("#collection");
  root.replaceChildren();
  if (!store.cards.length) {
    root.innerHTML =
      '<p class="empty">No demo eggs yet. Get an egg to begin.</p>';
    return;
  }
  for (const c of store.cards) {
    const card = document.createElement("article");
    card.className = "saved";
    card.dataset.cardId = c.id;
    const img = document.createElement("img");
    img.width = 200;
    img.height = 210;
    img.alt = c.kind === "egg" ? "Demo egg" : `Portrait of ${c.name}`;
    img.src = imageSource(
      c.kind === "egg"
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 420">${shellLayer(300, 215, false)}</svg>`
        : c.svg || portraitSVG(c.session),
    );
    const h = document.createElement("h3");
    h.textContent = c.name;
    const p = document.createElement("p");
    p.className = "note";
    p.textContent =
      c.kind === "egg"
        ? `Egg · ${Math.floor(c.session.elapsed)}/60 active seconds`
        : `Hamster · ${ACCESSORIES[c.session.accessoryId]}`;
    const button = document.createElement("button");
    button.className = "btn small";
    button.textContent = c.kind === "egg" ? "Open egg" : "Review hamster";
    button.disabled = busy || phase === "running";
    button.addEventListener("click", () => {
      if (busy || phase === "running") return;
      store.selected = c.id;
      saveDemo(store);
      selectDemo();
      $("#incubator").scrollIntoView({ block: "start" });
    });
    card.append(img, h, p, button);
    root.append(card);
  }
}
function renderLegacy() {
  try {
    const legacy = JSON.parse(
      localStorage.getItem("squeek-hatchery-v2") || "[]",
    );
    if (!Array.isArray(legacy) || !legacy.length) return;
    const title = document.createElement("h3");
    title.textContent = "Legacy portraits";
    $("#legacy").append(title);
    for (const rec of legacy) {
      if (
        typeof rec.svg !== "string" ||
        !rec.svg.startsWith("<svg ") ||
        typeof rec.name !== "string"
      )
        continue;
      const item = document.createElement("article"),
        img = document.createElement("img"),
        p = document.createElement("p"),
        button = document.createElement("button");
      item.className = "saved";
      img.src = imageSource(rec.svg);
      img.width = 160;
      img.height = 168;
      img.alt = `Legacy portrait of ${rec.name}`;
      p.textContent = rec.name + " · Legacy art";
      button.className = "btn small";
      button.textContent = "Download legacy SVG";
      button.addEventListener("click", () =>
        download(rec.svg, "image/svg+xml", "legacy-hamster.svg"),
      );
      item.append(img, p, button);
      $("#legacy").append(item);
    }
  } catch {
    /* no legacy collection */
  }
}
function selectDemo() {
  mode = "demo";
  nftSelection = null;
  nftOwnershipValid = false;
  const card = selectedCard(store);
  session = card?.session || freshSession();
  hasEgg = !!card;
  phase = session.endedAt ? "hatched" : "ready";
  finalName =
    card?.kind === "hamster" && card.name !== "Unnamed hamster"
      ? card.name
      : "";
  reviewing = !!finalName;
  frozen = null;
  renderMode();
}
function renderMode() {
  $("#nft-panel").hidden = mode !== "nft";
  $("#demo-layout").hidden = mode === "nft" && !nftSelection;
  $("#demo-collection").hidden = mode !== "demo";
  $("#tab-demo").setAttribute("aria-pressed", String(mode === "demo"));
  $("#tab-nft").setAttribute("aria-pressed", String(mode === "nft"));
  $("#stage").classList.toggle("hatched", phase === "hatched");
  renderResult();
  drawLamp();
  drawAnimal();
  renderPanels(liveReading(), false, performance.now());
}
function setMode(next: "demo" | "nft") {
  if (busy || phase === "running") {
    note("Finish the current incubation or transaction before changing modes.");
    return;
  }
  persistSession();
  if (next === "demo") selectDemo();
  else {
    mode = "nft";
    hasEgg = false;
    phase = "ready";
    nftSelection = null;
    frozen = null;
    renderMode();
    void refreshNfts();
  }
  location.hash = next === "demo" ? "demo" : "nfts";
}
$("#tab-demo").addEventListener("click", () => setMode("demo"));
$("#tab-nft").addEventListener("click", () => setMode("nft"));
window.addEventListener("hashchange", () => {
  if (location.hash === "#nfts" && mode !== "nft") setMode("nft");
  else if (location.hash === "#demo" && mode !== "demo") setMode("demo");
});
document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  pendingWork = 0n;
  resumeAt = null;
  persistSession();
  if (document.hidden) {
    reading = null;
    clearTimeout(pollTimer);
    if (mode === "nft") nftOwnershipValid = false;
  } else {
    void poll();
    if (mode === "nft") void guardNft();
  }
});
window.addEventListener("pagehide", () => {
  lastFrame = 0;
  resumeAt = null;
  pendingWork = 0n;
  reading = null;
  if (phase === "running") phase = "ready";
  if (mode === "nft") nftOwnershipValid = false;
  persistSession();
  releaseLock?.();
  releaseLock = null;
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  lastFrame = 0;
  resumeAt = null;
  reading = null;
  if (mode === "demo") {
    store = loadDemo();
    selectDemo();
    renderCollection();
  } else {
    if (phase === "running") phase = "ready";
    nftOwnershipValid = false;
    renderMode();
    void guardNft();
    void refreshNfts();
  }
  void poll();
});
window.addEventListener("storage", (e) => {
  if (e.key === STORE && mode === "demo" && phase !== "running" && !busy) {
    store = loadDemo();
    selectDemo();
    renderCollection();
  }
});

// Wallet state never controls the local demo or hardware polling.
function updateNftControls() {
  for (const id of ["claim", "nft-hatch", "hatch-submit"]) {
    const b = $<HTMLButtonElement>("#" + id);
    if (b)
      b.disabled =
        busy ||
        (id === "claim"
          ? !!claimReason
          : !!hatchReason || phase !== "hatched" || !reviewing || !!frozen);
  }
  text(
    "#claim-reason",
    claimReason || "One free egg per wallet; Sepolia gas applies.",
  );
  text(
    "#hatch-reason",
    hatchReason || "Incubate and review your selected egg before submitting.",
  );
  text(
    "#submit-reason",
    frozen
      ? "Confirmed result is frozen."
      : hatchReason ||
          "Ready for verifier attestation and wallet confirmation.",
  );
  for (const id of [
    "rename",
    "name",
    "review",
    "again",
    "get-egg",
    "tab-demo",
    "tab-nft",
  ]) {
    const b = $<HTMLButtonElement>("#" + id);
    if (b) b.disabled = busy;
  }
  $<HTMLButtonElement>("#save").disabled = busy;
}
async function refreshEligibility() {
  if (!walletReady) return;
  const c = W.connection(),
    epoch = walletEpoch;
  if (!W.runtime.contractAddress) {
    claimReason = hatchReason = "Contract not deployed";
    text("#contract-state", "Contract not deployed");
  } else {
    text("#contract-state", `Test contract: ${W.runtime.contractAddress}`);
    if (!c.address) claimReason = hatchReason = "Connect a wallet on Sepolia.";
    else if (c.chainId !== W.SEPOLIA_ID)
      claimReason = hatchReason = "Switch your wallet to Sepolia.";
    else {
      claimReason = "Checking claim availability…";
      hatchReason = "Checking verifier…";
      updateNftControls();
      try {
        const [schema, claimed, total, cap, verifier] = await Promise.all([
          W.read("schemaVersion"),
          W.read("hasClaimed", [c.address]),
          W.read("totalSupply"),
          W.read("supplyCap"),
          W.read("verifier"),
        ]);
        if (epoch !== walletEpoch) return;
        if (schema !== 3n) throw new Error("Incompatible contract schema");
        claimReason = claimed
          ? "This wallet has already claimed. Transfers do not reset claims."
          : (total as bigint) >= (cap as bigint)
            ? "The configured supply cap has been reached."
            : "";
        hatchReason = !nftSelection
          ? "Select an egg from your holdings."
          : String(verifier).toLowerCase() === zeroAddress
            ? "Hatch disabled: onchain verifier not configured."
            : !W.runtime.proofServiceUrl
              ? "Hatch disabled: proof service not configured."
              : !nftOwnershipValid
                ? "Hatch disabled: ownership must be checked again."
                : "";
      } catch (e) {
        if (epoch !== walletEpoch) return;
        claimReason = hatchReason =
          "NFT actions unavailable: " + W.errorMessage(e);
      }
    }
  }
  updateNftControls();
}
async function renderWallet() {
  const c = W.connection();
  walletEpoch++;
  const epoch = walletEpoch;
  const slot = $("#wallet-slot");
  slot.replaceChildren();
  const button = document.createElement("button");
  button.className = "btn small";
  if (c.address && c.isConnected) {
    button.textContent =
      c.chainId === W.SEPOLIA_ID
        ? `${W.short(c.address)} · Disconnect`
        : "Switch to Sepolia";
    button.addEventListener("click", () => {
      if (c.chainId !== W.SEPOLIA_ID)
        W.switchToSepolia().catch((e) => note(W.errorMessage(e)));
      else W.disconnectWallet();
    });
  } else {
    button.textContent = "Connect";
    button.addEventListener("click", openSheet);
  }
  slot.append(button);
  if (
    nftSelection &&
    (c.address?.toLowerCase() !== nftSelection.owner.toLowerCase() ||
      c.chainId !== W.SEPOLIA_ID)
  ) {
    nftOwnershipValid = false;
    resumeAt = null;
    persistSession();
    if (phase === "running") {
      phase = "ready";
      releaseLock?.();
      releaseLock = null;
    }
    if (!busy) {
      nftSelection = null;
      hasEgg = false;
      $("#result").hidden = true;
      renderMode();
    }
    note(
      "Wallet changed. NFT incubation is kept for its original owner. Select an owned egg again.",
    );
  }
  text(
    "#wallet-facts",
    c.address
      ? `Address: ${c.address} · Wallet network: ${c.chainId === W.SEPOLIA_ID ? "Sepolia" : `chain ${c.chainId}`} · Sepolia ETH: reading…`
      : "Connect to read your address, network and Sepolia ETH.",
  );
  if (c.address)
    W.walletFacts()
      .then((f) => {
        if (epoch === walletEpoch && f)
          text(
            "#wallet-facts",
            `Address: ${f.address} · Wallet network: ${f.network === W.SEPOLIA_ID ? "Sepolia" : `chain ${f.network}`} · Sepolia ETH: ${formatEther(f.balance)}`,
          );
      })
      .catch(() => {
        if (epoch === walletEpoch)
          text(
            "#wallet-facts",
            `Address: ${c.address} · Wallet network: ${c.chainId} · Sepolia ETH unavailable: RPC request failed.`,
          );
      });
  void refreshEligibility();
  if (mode === "nft") void refreshNfts();
}
async function refreshNfts(more = false) {
  if (!walletReady) return;
  const epoch = ++holdingsEpoch,
    c = W.connection();
  if (!more) {
    nftState = null;
    $("#nft-holdings").replaceChildren();
  }
  $("#more-nfts").hidden = true;
  if (!W.runtime.contractAddress) {
    text("#nft-status", "Holdings unavailable: contract not deployed.");
    return;
  }
  if (!c.address) {
    text("#nft-status", "Holdings unavailable: connect your wallet.");
    return;
  }
  if (c.chainId !== W.SEPOLIA_ID) {
    text("#nft-status", "Holdings unavailable: switch your wallet to Sepolia.");
    return;
  }
  text("#nft-status", "Reading holdings from Sepolia…");
  try {
    const result = await W.holdings(more ? nftState?.next || 0n : 0n);
    if (epoch !== holdingsEpoch) return;
    nftState = {
      ...result,
      tokens: [...(more ? nftState?.tokens || [] : []), ...result.tokens],
    };
    text(
      "#nft-status",
      `${number(result.count)} NFT${result.count === 1n ? "" : "s"} owned by this wallet.`,
    );
    renderHoldings();
  } catch (e) {
    if (epoch === holdingsEpoch)
      text("#nft-status", "Holdings unavailable: " + W.errorMessage(e));
  }
  await refreshEligibility();
}
function renderHoldings() {
  const root = $("#nft-holdings");
  root.replaceChildren();
  if (!nftState) return;
  for (const token of nftState.tokens) {
    const card = document.createElement("article"),
      img = document.createElement("img"),
      h = document.createElement("h3"),
      p = document.createElement("p"),
      b = document.createElement("button");
    card.className = "saved";
    img.width = 200;
    img.height = 210;
    img.alt = token.hatched ? `NFT ${token.name}` : `NFT egg #${token.id}`;
    img.src = token.image;
    h.textContent = token.name;
    p.textContent = `Token #${token.id} · ${token.hatched ? "Hamster" : "Egg"}`;
    p.className = "note";
    b.className = "btn small";
    b.textContent = token.hatched ? "Download NFT JSON" : "Select egg";
    b.disabled = busy || phase === "running";
    b.addEventListener("click", () => {
      if (token.hatched)
        download(token.metadata, "application/json", `squeek-${token.id}.json`);
      else void selectNft(token.id);
    });
    card.append(img, h, p, b);
    root.append(card);
  }
  $("#more-nfts").hidden = nftState.next >= nftState.count;
}
async function selectNft(id: string) {
  // Re-read shared state after the asynchronous ownership check as well.
  const unavailable = () => busy || phase === "running";
  if (unavailable()) return;
  const c = W.connection();
  if (!c.address) return;
  try {
    await W.assertOwner(BigInt(id), c.address);
    if (mode !== "nft" || unavailable()) return;
    const key = `squeek-nft-draft-v3:${W.runtime.contractAddress}:${id}:${c.address.toLowerCase()}`;
    let draft: null | {
      session: Session;
      name: string;
      frozen: typeof frozen;
    } = null;
    try {
      draft = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      /* first session */
    }
    nftSelection = { id, owner: c.address, key };
    nftOwnershipValid = true;
    session =
      draft && validSession(draft.session) ? draft.session : freshSession();
    finalName = draft?.name && validName(draft.name) ? draft.name : "";
    frozen = draft?.frozen || null;
    hasEgg = true;
    phase = session.endedAt ? "hatched" : "ready";
    reviewing = phase === "hatched" && !!finalName;
    mode = "nft";
    renderMode();
    void refreshEligibility();
    $("#incubator").scrollIntoView({ block: "start" });
  } catch (e) {
    note(W.errorMessage(e));
  }
}
async function guardNft() {
  if (!nftSelection || !walletReady) return;
  const selected = nftSelection;
  nftGuardPending = true;
  try {
    await W.assertOwner(BigInt(selected.id), selected.owner);
    if (nftSelection === selected) nftOwnershipValid = true;
  } catch (e) {
    if (nftSelection === selected) {
      nftOwnershipValid = false;
      resumeAt = null;
      if (phase === "running") {
        phase = "ready";
        persistSession();
        releaseLock?.();
        releaseLock = null;
      }
      note(W.errorMessage(e));
    }
  } finally {
    nftGuardPending = false;
    void refreshEligibility();
  }
}
$("#refresh-nft").addEventListener("click", () => {
  void refreshNfts();
  void guardNft();
});
$("#more-nfts").addEventListener("click", () => void refreshNfts(true));
$("#nft-hatch").addEventListener("click", () => {
  if (phase === "hatched") {
    $("#result").scrollIntoView({ block: "start" });
    $("#hatch-submit").focus();
  }
});
async function transaction(kind: "claim" | "hatch") {
  if (
    busy ||
    !walletReady ||
    (kind === "claim"
      ? !!claimReason
      : !!hatchReason || !reviewing || !nftSelection || !!frozen)
  )
    return;
  const selected = nftSelection,
    rec = kind === "hatch" ? currentResult() : null,
    snapshot = structuredClone(session);
  busy = true;
  updateNftControls();
  renderResult();
  renderHoldings();
  $("#nft-panel").scrollIntoView({ block: "start" });
  let confirmed = false;
  try {
    await W.transact(
      kind,
      (e) => {
        if (e.kind === "checking")
          text("#tx-status", "Checking contract and wallet…");
        if (e.kind === "proof")
          text(
            "#tx-status",
            "Requesting session attestation from the configured proof service…",
          );
        if (e.kind === "confirm")
          text(
            "#tx-status",
            "Confirm in your wallet. Sepolia test gas applies.",
          );
        if (e.kind === "pending")
          text(
            "#tx-status",
            `Transaction ${e.hash} sent. Waiting for a receipt…`,
          );
        if (e.kind === "success") {
          confirmed = true;
          text(
            "#tx-status",
            `${kind === "claim" ? "Egg claimed" : "Hamster confirmed"} as token #${e.tokenId}. Transaction: ${e.hash}`,
          );
          if (kind === "hatch" && rec && selected) {
            frozen = { ...rec };
            finalName = rec.name;
            try {
              localStorage.setItem(
                selected.key,
                JSON.stringify({ session: snapshot, name: rec.name, frozen }),
              );
            } catch {
              /* result remains downloadable */
            }
            renderResult();
          }
        }
      },
      selected ? BigInt(selected.id) : undefined,
      kind === "hatch" ? companionOf(snapshot, rec!.name) : undefined,
      kind === "hatch" ? snapshot : undefined,
    );
  } catch (e) {
    text("#tx-status", W.errorMessage(e));
  } finally {
    try {
      await refreshNfts();
      await refreshEligibility();
    } finally {
      busy = false;
      renderResult();
      renderCollection();
      renderHoldings();
      updateNftControls();
    }
    if (kind === "claim" && confirmed) {
      note("Egg claim confirmed. Select it in My NFTs to incubate.");
    } else if (kind === "claim") {
      note($("#tx-status").textContent || "Claim did not complete.");
    }
  }
}
$("#claim").addEventListener("click", () => void transaction("claim"));
$("#hatch-submit").addEventListener("click", () => void transaction("hatch"));
const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"\']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "\'": "&#39;",
      })[c]!,
  );
let sheetReturn: HTMLElement | null = null;
let sheetGeneration = 0;
function openSheet() {
  const generation = ++sheetGeneration;
  sheetReturn = document.activeElement as HTMLElement;
  const mobile = W.isMobileBrowser();
  const rows = W.walletRows().filter(
    (r) => !mobile || r.connector.type !== "injected",
  );
  const here = location.href;
  const root = $("#sheet-root");
  root.innerHTML = `<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-head"><h2 id="sheet-title">Connect a wallet</h2><button type="button" class="x" id="sheet-x" aria-label="Close">×</button></div>
    ${mobile ? W.OPEN_IN.map((w) => `<a class="row" href="${w.href(here)}"><span class="ic" aria-hidden="true">${walletMark(w.id)}</span><span>Open in ${w.name}</span></a>`).join("") : ""}
    ${rows.map((r, i) => `<button type="button" class="row" data-i="${i}"><span class="ic" aria-hidden="true">${r.connector.icon?.startsWith("data:image/") ? `<img src="${escapeHTML(r.connector.icon)}" width="28" height="28" alt="">` : walletMark(r.connector.id)}</span><span class="row-label">${escapeHTML(r.label)}</span></button>`).join("")}
    <p class="note" id="sheet-note" role="status"></p></div></div>`;
  document
    .querySelectorAll<HTMLElement>("header,main,footer")
    .forEach((e) => (e.inert = true));
  const close = () => {
    if (generation !== sheetGeneration) return;
    sheetGeneration++;
    document
      .querySelectorAll<HTMLElement>("header,main,footer")
      .forEach((e) => (e.inert = false));
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
    if (sheetReturn?.isConnected) sheetReturn.focus();
    else $("#wallet-slot button")?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      // keep focus inside the sheet
      const f = [...root.querySelectorAll<HTMLElement>("button,a")];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener("keydown", onKey);
  $("#sheet-bg").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) close();
  });
  $("#sheet-x").addEventListener("click", close);
  root.querySelectorAll<HTMLButtonElement>("button[data-i]").forEach((b) =>
    b.addEventListener("click", async () => {
      const row = rows[Number(b.dataset.i)];
      root
        .querySelectorAll<HTMLButtonElement>("button[data-i]")
        .forEach((x) => (x.disabled = true));
      b.querySelector(".row-label")!.textContent = `${row.label} · opening…`;
      try {
        await W.connectWith(row.connector);
        close();
      } catch {
        if (generation !== sheetGeneration) return;
        $("#sheet-note").textContent =
          `${row.label} did not connect. You can try again.`;
        b.querySelector(".row-label")!.textContent = row.label;
        root
          .querySelectorAll<HTMLButtonElement>("button[data-i]")
          .forEach((x) => (x.disabled = false));
      }
    }),
  );
  root.querySelector<HTMLElement>(".row")?.focus() ?? $("#sheet-x").focus();
}

function walletMark(id: string) {
  const name = id === "coinbaseWalletSDK" ? "coinbase" : id;
  if (["metamask", "coinbase", "rabby", "phantom"].includes(name))
    return `<img src="./wallet-${name}.svg" width="28" height="28" alt="">`;
  return `<svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="22" height="17" rx="4"/><path d="M5 6V4h17v2m-3 7h6v6h-6z"/></svg>`;
}
let qaRendered = false;
document.querySelector(".qa")!.addEventListener("toggle", () => {
  if (qaRendered) return;
  qaRendered = true;
  const qa = $("#qa-art");
  const add = (s: Session, label: string) => {
    const fig = document.createElement("figure"),
      img = document.createElement("img"),
      cap = document.createElement("figcaption");
    img.src = imageSource(portraitSVG(s));
    img.alt = label;
    img.width = 200;
    img.height = 210;
    cap.textContent = label;
    fig.append(img, cap);
    qa.append(fig);
  };
  for (const [name, g] of [
    ["Low", 0],
    ["Medium", 0.5],
    ["High", 1],
  ] as const) {
    const s = freshSession("study-" + name);
    s.regions.forEach((r) => (r.growth = g));
    add(s, `${name} ears and fur · same unlit coat`);
  }
  for (const [name, values] of [
    ["Head only", [1, 0, 0]],
    ["Middle only", [0, 1, 0]],
    ["Lower only", [0, 0, 1]],
  ] as const) {
    const s = freshSession("mixed-" + name.replace(" ", ""));
    values.forEach((v, i) => (s.regions[i].growth = v));
    add(s, name + " · mixed growth");
  }
  const mixed = freshSession("mixed-colors");
  mixed.regions[0].growth = 1;
  mixed.regions[1].growth = 0.6;
  mixed.regions[2].growth = 0.25;
  mixed.bands.forEach((b) => {
    if (b.y < 180) {
      b.dose = 15;
      b.rgb = [160, 199, 220];
    } else if (b.y > 265) {
      b.dose = 15;
      b.rgb = [239, 179, 177];
    }
  });
  add(mixed, "Mixed local colors · untouched middle");
  for (const [name, kind] of [
    ["Pearl", "pearl"],
    ["Rainbow", "rainbow"],
  ] as const) {
    const s = freshSession("study-" + kind);
    s.regions.forEach((r) => (r.growth = 0.65));
    s.bands.forEach((b) => {
      if (b.y > 240 && b.y < 330) {
        b.dose = 20;
        b[kind] = 1;
      }
    });
    add(s, name + " · local light only");
  }
  ACCESSORIES.forEach((name, i) => {
    const s = freshSession("accessory-" + i);
    s.endedAt = "synthetic";
    s.accessoryId = i as Session["accessoryId"];
    s.regions.forEach((r) => (r.growth = 0.6));
    add(s, name);
  });
});
drawLamp();
drawAnimal();
renderCollection();
renderLegacy();
renderMode();
const walletInit = W.initWallet().then(() => {
  walletReady = true;
  void renderWallet();
  W.onConnection(() => void renderWallet());
  W.onConnectors(() => {});
  if (location.hash === "#nfts") setMode("nft");
});
$("#w-connect").addEventListener("click", () =>
  walletInit
    .then(openSheet)
    .catch(() => note("Wallet setup is unavailable. Reload to retry.")),
);
void poll();
requestAnimationFrame(frame);
