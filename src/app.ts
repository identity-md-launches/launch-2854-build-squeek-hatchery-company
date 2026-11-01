import "./style.css";
import {
  DURATION, PATTERN_LABEL, REGION_NAMES, SignalError, beamY, clamp, colorCss, colorName, develop, freshSession, lampGeometry,
  lampPower, lockPattern, nextSpecialColor, palette, patternPreview, positionForRailY, regionAt, validateStatus, workDelta,
  type LampColor, type Reading, type Session,
} from "./rules.ts";
import { animalGroup, patternMiniature, portraitSVG, shellLayer } from "./art.ts";
import { buildTraits, metadataJSON, validName } from "./metadata.ts";
import * as W from "./wallet.ts";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const API = "https://api.squeekchain.com/v1/status";
const STORE = "squeek-hatchery-v2";

interface SavedRecord { name: string; svg: string; traits: string; session: Session; hatchedAt: string; mint?: { tokenId: string; tx?: string; contract: string } }

// ---------- State ----------
let session = freshSession();
let phase: "ready" | "running" | "hatched" = "ready";
let reading: Reading | null = null;
// Signal loss must never erase the last accepted timestamp/counter used to reject replays.
let replayBaseline: Reading | null = null;
let lastOk = 0;
let signalNote = "Connecting to the wheel";
let signalReason: SignalError["reason"] | "network" | null = null;
let pollDelay = 4000;
let pollTimer = 0;
let resumeAt: number | null = null;
let lastFrame = 0;
let lastAnimal = 0;
let pendingWork = 0n;
let history: { t: number; work: bigint; mm: number; epoch: string }[] = [];
let finalName = "";
let reviewing = false;
let records: SavedRecord[] = loadRecords();

function loadRecords(): SavedRecord[] {
  try {
    const r = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(r) ? r.filter((x) => typeof x?.name === "string" && typeof x?.svg === "string" && x.svg.startsWith("<svg ")).slice(0, 30) : [];
  } catch { return []; }
}
function persist() { localStorage.setItem(STORE, JSON.stringify(records.slice(0, 30))); }

// ---------- Markup ----------
const logo = `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><ellipse cx="16" cy="17" rx="11" ry="13" fill="#f5e3c8" stroke="#a8492a" stroke-width="2"/><circle cx="12.5" cy="16" r="1.6" fill="#3b2a24"/><circle cx="19.5" cy="16" r="1.6" fill="#3b2a24"/><path d="M15 19.5h2l-1 1.2z" fill="#a8492a"/></svg>`;

$("#app").innerHTML = `
<a class="skip" href="#incubator">Skip to the incubator</a>
<header class="top">
  <a class="brand" href="#">${logo}<span>Squeek Hatchery</span></a>
  <nav aria-label="Site"><a href="#how">How it works</a><a href="#collection-title">Collection</a></nav>
  <div id="wallet-slot"></div>
</header>
<main>
  <section class="hero" aria-labelledby="title">
    <h1 id="title">Hatch a hamster with light</h1>
    <p class="lead">A real hamster’s wheel powers your hatchery lamp.</p>
  </section>
  <div class="layout">
    <section id="incubator" class="incubator" aria-labelledby="incubator-title">
      <h2 id="incubator-title" class="sr-only">Incubator</h2>
      <div class="stage-bar">
        <p id="signal-pill" class="pill" role="status">Connecting to the wheel</p>
        <p class="timer"><span class="sr-only">Incubation time left </span><strong id="timer">1:00</strong></p>
      </div>
      <div class="stage" id="stage">
        <svg id="stage-svg" viewBox="0 0 400 420" aria-hidden="true">
          <defs><radialGradient id="glow"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".9"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></radialGradient>
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
      <p class="hint" id="hint">Drag the lamp up or down on the right, or use the arrow keys.</p>
      <div class="regions" role="group" aria-label="Aim the lamp at">
        <button type="button" data-pos="-70">Head</button><button type="button" data-pos="0">Middle</button><button type="button" data-pos="70">Lower body</button>
      </div>
      <div class="progress" aria-hidden="true"><span id="progress"></span></div>
      <div class="actions">
        <button type="button" id="start" class="btn primary" disabled>Waiting for the wheel</button>
        <button type="button" id="again" class="btn" hidden>Incubate another egg</button>
      </div>
      <p class="note" id="start-note">Incubation counts only while the wheel signal is fresh and this tab is visible.</p>
    </section>
    <div class="panels">
      <section class="card" aria-labelledby="signal-title">
        <h2 id="signal-title">Wheel signal</h2>
        <p id="signal-state" class="state">Connecting</p>
        <dl class="stats">
          <div><dt>Wheel speed</dt><dd id="rpm">Unavailable</dd></div>
          <div><dt>Lamp power</dt><dd id="power">Unavailable</dd></div>
          <div><dt>Distance today</dt><dd id="meters">Unavailable</dd></div>
          <div><dt>Work units</dt><dd id="work">Unavailable</dd></div>
        </dl>
        <p class="note" id="signal-age">Live data from the Squeekchain status API. Work units are API units, not verified wheel turns.</p>
      </section>
      <section class="card" aria-labelledby="light-title">
        <h2 id="light-title">Lamp color</h2>
        <div class="pair">
          <figure><span class="swatch" id="sw-now"></span><figcaption><span class="label">Now</span><span id="c-now">Unavailable</span></figcaption></figure>
          <figure><span class="swatch" id="sw-next"></span><figcaption><span class="label">Next</span><span id="c-next">Unavailable</span></figcaption></figure>
        </div>
        <p class="note" id="c-remaining">Color changes every 5 m of the day's distance.</p>
        <p class="note" id="c-special">Pearl from 250 m and rainbow from 500 m, each for 5 m.</p>
      </section>
      <section class="card" aria-labelledby="pattern-title">
        <h2 id="pattern-title">Coat pattern</h2>
        <div class="locked" id="locked"></div>
        <div class="pair">
          <figure><span class="mini" id="p-now"></span><figcaption><span class="label">Wheel now</span><span id="p-now-name">Unavailable</span></figcaption></figure>
          <figure><span class="mini" id="p-next"></span><figcaption><span class="label">Next</span><span id="p-next-name">Unavailable</span></figcaption></figure>
        </div>
        <p class="note" id="p-remaining">Each pattern lasts 50 work units.</p>
        <p class="note" id="p-special">Stars at 1,000 and swirls at 2,000, alternating every 1,000 units.</p>
      </section>
      <section class="card" aria-labelledby="traits-title">
        <h2 id="traits-title">Growing traits</h2>
        <ul class="traits">${REGION_NAMES.map((n, i) => `<li><span>${n}</span><span class="meter"><span id="m${i}"></span></span><strong id="t${i}">0%</strong></li>`).join("")}</ul>
        <p class="note">Head light grows ears, middle light grows fluff, lower light grows the lower coat and pom tail. Hidden traits are kept.</p>
      </section>
    </div>
  </div>

  <section id="result" class="result card" hidden aria-labelledby="result-title" tabindex="-1">
    <h2 id="result-title">Your hamster has hatched</h2>
    <div class="result-grid">
      <div class="portrait" id="portrait"></div>
      <div class="result-body">
        <form id="name-form" novalidate>
          <label for="name">Name</label>
          <input id="name" name="name" maxlength="30" autocomplete="off" required aria-describedby="name-help">
          <p class="note" id="name-help">Up to 30 letters, numbers, spaces and . , ' -</p>
          <button type="submit" class="btn primary" id="review">Review portrait</button>
        </form>
        <div id="review-panel" hidden>
          <p class="named"><strong id="final-name"></strong> <button type="button" class="link" id="rename">Change name</button></p>
          <p class="note">This is the exact portrait and trait list that downloads, saves and mints.</p>
          <ul class="trait-list" id="trait-list"></ul>
          <div class="row">
            <button type="button" class="btn primary" id="save">Save to this browser</button>
            <button type="button" class="btn" id="dl-svg">Download SVG</button>
            <button type="button" class="btn" id="dl-json">Download JSON</button>
          </div>
          <div class="mint-box">
            <h3>Optional: mint on Sepolia</h3>
            <p class="note">Free mint on the Sepolia test network; you pay only test gas. Your wallet confirms the transaction.</p>
            <button type="button" class="btn" id="mint" disabled>Mint unavailable</button>
            <p id="mint-status" class="mint-status" role="status" aria-live="polite"></p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="collection" aria-labelledby="collection-title">
    <h2 id="collection-title">Your collection</h2>
    <p class="note">Saved in this browser only. Download a portrait to keep a copy elsewhere.</p>
    <div id="collection" class="grid"></div>
  </section>

  <section id="how" class="how" aria-labelledby="how-title">
    <h2 id="how-title">How it works</h2>
    <ul>
      <li><strong>Real wheel, real light.</strong> The lamp's power follows the wheel: a 12% maintenance glow while the hamster rests, full power at 120 RPM. If the signal is missing, stale or not from hardware, incubation pauses and resumes after a 3 second countdown.</li>
      <li><strong>Aim, don't move the egg.</strong> The egg stays still. The lamp slides on its rail and always points straight into the shell. The shell turns see-through only under the beam.</li>
      <li><strong>Color and pattern from light.</strong> The longer and brighter a spot is lit, the deeper its color and the clearer its pattern. Other areas keep what they already have.</li>
      <li><strong>Pattern locks at the start.</strong> The work counter picks the pattern family and layout when you begin. Stars and swirls appear only in their 50 unit windows.</li>
      <li><strong>Yours, wallet-free.</strong> Name, save and download without a wallet. Minting on Sepolia is optional and freezes the exact portrait you reviewed.</li>
    </ul>
  </section>
</main>
<footer class="foot"><p>Unofficial community project using the public Squeekchain status API. Sepolia testnet only; no token sale.</p></footer>
<div id="sheet-root"></div>`;

const stage = $("#stage");
const lamp = $("#lamp");

// ---------- Polling ----------
async function poll() {
  window.clearTimeout(pollTimer);
  if (document.hidden) return; // resumes on visibilitychange
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) {
      const retry = Number(res.headers.get("Retry-After")) * 1000;
      pollDelay = clamp(Math.max(retry || 0, pollDelay * 2), 8000, 60000);
      throw new SignalError("missing", `Status API answered ${res.status}`);
    }
    const next = validateStatus(await res.json(), Date.now(), replayBaseline);
    if (phase === "running" && !document.hidden) pendingWork += workDelta(reading, next);
    if (history.length && (history[history.length - 1].epoch !== next.counterEpoch || next.distanceMm < history[history.length - 1].mm)) history = [];
    history.push({ t: next.observedAt, work: next.work, mm: next.distanceMm, epoch: next.counterEpoch });
    history = history.filter((h) => next.observedAt - h.t < 180_000).slice(-60);
    reading = next;
    replayBaseline = next;
    lastOk = Date.now();
    signalReason = null;
    pollDelay = 4000;
  } catch (e) {
    reading = null;
    signalReason = e instanceof SignalError ? e.reason : "network";
    signalNote = e instanceof SignalError ? e.message : "The status API could not be reached";
    if (!(e instanceof SignalError) || e.reason !== "missing") pollDelay = clamp(pollDelay * 1.6, 4000, 60000);
  } finally {
    if (!document.hidden) pollTimer = window.setTimeout(poll, pollDelay);
  }
}

function liveReading(): Reading | null {
  if (!reading) return null;
  const now = Date.now();
  if (now - lastOk > 15_000 || now - reading.received > reading.staleAfterSeconds * 1000) return null;
  return reading;
}

function rates() {
  if (history.length < 2) return null;
  const a = history[0], b = history[history.length - 1];
  const minutes = (b.t - a.t) / 60000;
  if (minutes < 0.2) return null;
  return { workPerMin: Number(b.work - a.work) / minutes, metersPerMin: (b.mm - a.mm) / 1000 / minutes };
}
function eta(amount: number, perMin: number | undefined) {
  if (!perMin || perMin <= 0) return "waiting time unknown at rest";
  const min = amount / perMin;
  return min < 1 ? "under a minute at the current pace" : `about ${Math.round(min)} min at the current pace`;
}
const n = (v: bigint | number) => v.toLocaleString("en-US");

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
  el.addEventListener("pointermove", (e) => { if (dragging) aim(positionForRailY(railYFromEvent(e))); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, () => (dragging = false));
}
lamp.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 20 : 5;
  const map: Record<string, number> = { ArrowUp: -step, ArrowLeft: -step, ArrowDown: step, ArrowRight: step, PageUp: -25, PageDown: 25 };
  if (e.key in map) { e.preventDefault(); aim(session.lampPosition + map[e.key]); }
  else if (e.key === "Home") { e.preventDefault(); aim(-100); }
  else if (e.key === "End") { e.preventDefault(); aim(100); }
});
document.querySelectorAll<HTMLButtonElement>("[data-pos]").forEach((b) => b.addEventListener("click", () => aim(Number(b.dataset.pos))));

// ---------- Stage drawing ----------
let currentColor: LampColor | null = null;
let lit = false;

function drawLamp() {
  const g = lampGeometry(session.lampPosition);
  $("#lamp-art").setAttribute("transform", `translate(${g.sourceX} ${g.sourceY})`);
  $("#lamp-rot").setAttribute("transform", `rotate(${(g.angle - 180).toFixed(1)})`);
  lamp.style.top = `${(g.sourceY / 420) * 100}%`;
  lamp.style.left = `${(g.sourceX / 400) * 100}%`;
  const region = regionAt(session.lampPosition);
  lamp.setAttribute("aria-valuenow", String(Math.round(session.lampPosition)));
  lamp.setAttribute("aria-valuetext", `Lighting the ${["head", "middle", "lower body"][region]}`);
  document.querySelectorAll<HTMLButtonElement>("[data-pos]").forEach((b) => b.setAttribute("aria-pressed", String(regionAt(Number(b.dataset.pos)) === region)));
  // Beam from the bulb to the surface point, widening toward the egg.
  const bx = g.sourceX + Math.cos((g.angle * Math.PI) / 180) * 26, by = g.sourceY + Math.sin((g.angle * Math.PI) / 180) * 26;
  const px = -Math.sin((g.angle * Math.PI) / 180), py = Math.cos((g.angle * Math.PI) / 180);
  const pts = [[bx + px * 6, by + py * 6], [g.targetX + px * 34, g.targetY + py * 34], [g.targetX - px * 34, g.targetY - py * 34], [bx - px * 6, by - py * 6]];
  $("#beam").setAttribute("points", pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" "));
  $("#spot").setAttribute("cx", (g.targetX - 40).toFixed(1));
  $("#spot").setAttribute("cy", g.targetY.toFixed(1));
  $("#shell").innerHTML = phase === "hatched" ? "" : shellLayer(g.targetX, g.targetY, lit);
}

function drawAnimal() { $("#animal").innerHTML = animalGroup(session, "s"); }

// ---------- Main loop ----------
function frame(t: number) {
  const dt = lastFrame ? Math.min(0.25, (t - lastFrame) / 1000) : 0; // never catch up on missed time
  lastFrame = t;
  const m = liveReading();
  const visible = !document.hidden;
  currentColor = m ? palette(m.distanceMm, m.utcDate) : null;
  let paused = false;
  if (phase === "running") {
    if (!m || !visible) { paused = true; resumeAt = null; pendingWork = 0n; }
    else if (resumeAt === null) { resumeAt = t + 3000; paused = true; }
    else if (t < resumeAt) paused = true;
    else {
      const done = develop(session, dt, m.rpm, currentColor!, pendingWork);
      pendingWork = 0n;
      if (done) hatch();
    }
  }
  const wasLit = lit;
  lit = !!m && phase !== "hatched" && !(phase === "running" && paused && !m);
  const power = m ? lampPower(m.rpm) : 0;
  document.documentElement.style.setProperty("--lamp", currentColor ? (currentColor.kind === "rainbow" ? "#f6d2e4" : currentColor.kind === "pearl" ? "#f4e2f0" : `hsl(${currentColor.hue} 85% 78%)`) : "#777");
  $("#beam-layer").style.opacity = lit ? String(0.25 + 0.75 * power) : "0";
  $("#bulb").setAttribute("fill", lit ? "var(--lamp)" : "#8d7d78");
  if (wasLit !== lit || t - lastAnimal > 120) { drawLamp(); }
  if (t - lastAnimal > 120) { drawAnimal(); lastAnimal = t; }
  renderPanels(m, paused, t);
  requestAnimationFrame(frame);
}

function renderPanels(m: Reading | null, paused: boolean, t: number) {
  const pill = $("#signal-pill");
  const resting = m?.coreStatus === "IDLE";
  const stateText = !m ? "Signal missing" : resting ? "Resting: 12% maintenance glow" : `Running: ${Math.round(lampPower(m.rpm) * 100)}% lamp power`;
  pill.textContent = stateText;
  pill.dataset.state = !m ? "missing" : resting ? "rest" : "run";
  $("#signal-state").textContent = !m ? `Signal missing. ${signalNote}. Incubation pauses until fresh hardware data returns.` : resting ? "Resting with maintenance light." : "The hamster is running. The lamp follows its speed.";
  $("#rpm").textContent = m ? `${m.rpm.toFixed(1)} RPM` : "Unavailable";
  $("#power").textContent = m ? `${Math.round(lampPower(m.rpm) * 100)}%` : "Unavailable";
  $("#meters").textContent = m ? `${m.meters.toFixed(1)} m` : "Unavailable";
  $("#work").textContent = m ? n(m.work) : "Unavailable";
  $("#signal-age").textContent = m ? `Hardware reading from ${Math.max(0, Math.round((Date.now() - m.observedAt) / 1000))} s ago. Work units are API units, not verified wheel turns.` : "No fresh hardware reading. Nothing is simulated or filled in.";

  const r = rates();
  if (m && currentColor) {
    const next = palette((currentColor.segment + 1) * 5000, currentColor.date);
    ($("#sw-now") as HTMLElement).style.background = colorCss(currentColor);
    ($("#sw-next") as HTMLElement).style.background = colorCss(next);
    $("#sw-now").classList.remove("off"); $("#sw-next").classList.remove("off");
    $("#c-now").textContent = colorName(currentColor);
    $("#c-next").textContent = colorName(next);
    $("#c-remaining").textContent = `${currentColor.remainingMeters.toFixed(1)} m to the next color, ${eta(currentColor.remainingMeters, r?.metersPerMin)}.`;
    const sp = nextSpecialColor(m.distanceMm);
    $("#c-special").textContent = currentColor.kind !== "ordinary" ? `${colorName(currentColor)} is active now.` : `Next ${sp.kind} passage in ${sp.meters.toFixed(1)} m, ${eta(sp.meters, r?.metersPerMin)}.`;
  } else {
    for (const id of ["#sw-now", "#sw-next"]) { $(id).style.background = ""; $(id).classList.add("off"); }
    $("#c-now").textContent = "Unavailable"; $("#c-next").textContent = "Unavailable";
    $("#c-remaining").textContent = "Color preview unavailable without a fresh reading.";
    $("#c-special").textContent = "Pearl from 250 m and rainbow from 500 m, each for 5 m.";
  }
  if (m) {
    const p = patternPreview(m.work);
    setMini("#p-now", p.type, p.seed); setMini("#p-next", p.next, p.nextSeed);
    $("#p-now-name").textContent = PATTERN_LABEL[p.type]; $("#p-next-name").textContent = PATTERN_LABEL[p.next];
    $("#p-remaining").textContent = `${n(p.remaining)} work units until the next pattern, ${eta(Number(p.remaining), r?.workPerMin)}.`;
    $("#p-special").textContent = `Next special: ${PATTERN_LABEL[p.nextSpecial.type].replace(" (special)", "").toLowerCase()} in ${n(p.nextSpecial.remaining)} work units, ${eta(Number(p.nextSpecial.remaining), r?.workPerMin)}.`;
  } else {
    for (const id of ["#p-now", "#p-next"]) { $(id).innerHTML = ""; $(id).dataset.key = ""; $(id).classList.add("off"); }
    $("#p-now-name").textContent = "Unavailable"; $("#p-next-name").textContent = "Unavailable";
    $("#p-remaining").textContent = "Pattern preview unavailable without a fresh reading.";
    $("#p-special").textContent = "Stars at 1,000 and swirls at 2,000, alternating every 1,000 units.";
  }
  const locked = $("#locked");
  const key = session.patternSource ? `${session.patternType}:${session.patternSeed}` : "none";
  if (locked.dataset.key !== key) {
    locked.dataset.key = key;
    locked.innerHTML = session.patternSource
      ? `${patternMiniature(session.patternType, session.patternSeed, `${PATTERN_LABEL[session.patternType]} layout`)}<p><strong>This egg: ${PATTERN_LABEL[session.patternType]}</strong><br><span class="note">Locked at ${n(BigInt(session.patternSource.cumulativeWorkUnits))} work units. Light reveals it.</span></p>`
      : `<p class="note">Pattern locks at start.</p>`;
  }
  session.regions.forEach((g, i) => { $(`#m${i}`).style.width = `${g.growth * 100}%`; $(`#t${i}`).textContent = `${Math.round(g.growth * 100)}%`; });

  const left = Math.ceil(Math.max(0, DURATION - session.elapsed));
  $("#timer").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  $("#progress").style.width = `${(session.elapsed / DURATION) * 100}%`;
  const pause = $("#pause");
  pause.hidden = !(phase === "running" && paused);
  if (!pause.hidden) {
    const counting = resumeAt !== null && !!m && !document.hidden;
    $("#pause-title").textContent = counting ? `Resuming in ${Math.max(1, Math.ceil((resumeAt! - t) / 1000))}` : "Paused";
    $("#pause-copy").textContent = counting ? "Fresh hardware data is back." : "Waiting for a fresh hardware reading.";
  }
  const start = $<HTMLButtonElement>("#start");
  start.hidden = phase !== "ready";
  start.disabled = !m;
  start.textContent = m ? "Begin incubation" : "Waiting for the wheel";
  $("#again").hidden = phase !== "hatched";
  $("#start-note").hidden = phase === "hatched";
  const region = regionAt(session.lampPosition);
  $("#hint").textContent = phase === "hatched" ? "Hatched. This is the same hamster that grew in the egg."
    : phase === "running" ? (paused ? "Incubation is paused. Your progress is kept." : `Lighting the ${["head: ears are growing", "middle: fluff is growing", "lower body: lower coat and pom are growing"][region]}.`)
    : "Drag the lamp up or down on the right, or use the arrow keys.";
}

function setMini(sel: string, type: Parameters<typeof patternMiniature>[0], seed: number) {
  const el = $(sel);
  const key = `${type}:${seed}`;
  el.classList.remove("off");
  if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = patternMiniature(type, seed, `${PATTERN_LABEL[type]} preview`); }
}

// ---------- Flow ----------
$("#start").addEventListener("click", () => {
  const m = liveReading();
  if (!m || phase !== "ready") return;
  lockPattern(session, m);
  session.startedAt = new Date().toISOString();
  phase = "running";
  resumeAt = performance.now(); // start immediately; later interruptions use the 3 s countdown
  pendingWork = 0n;
  lamp.focus();
});

function hatch() {
  phase = "hatched";
  session.endedAt = new Date().toISOString();
  $("#stage").classList.add("hatched");
  drawLamp(); drawAnimal();
  const result = $("#result");
  result.hidden = false;
  $("#portrait").innerHTML = portraitSVG(session);
  $("#portrait svg").setAttribute("role", "img");
  $("#portrait svg").setAttribute("aria-label", "Final portrait of your hatched hamster");
  $<HTMLInputElement>("#name").value = "";
  showReview(false);
  result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  $("#name").focus({ preventScroll: true });
}

function showReview(on: boolean) {
  reviewing = on;
  $("#name-form").hidden = on;
  $("#review-panel").hidden = !on;
}

$("#name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (mintBusy || mintedRecord()) return;
  const input = $<HTMLInputElement>("#name");
  const value = input.value.trim().replace(/\s+/g, " ");
  if (!validName(value)) {
    input.setAttribute("aria-invalid", "true");
    $("#name-help").textContent = "Use 1 to 30 letters, numbers, spaces and . , ' - (no spaces at the ends).";
    input.focus();
    return;
  }
  input.removeAttribute("aria-invalid");
  $("#name-help").textContent = "Up to 30 letters, numbers, spaces and . , ' -";
  finalName = value;
  renderReviewedRecord(currentRecord());
  showReview(true);
  updateMintButton();
  $("#final-name").focus();
});
$("#final-name").tabIndex = -1;
$("#rename").addEventListener("click", () => {
  if (mintBusy || mintedRecord()) return;
  showReview(false);
  $<HTMLInputElement>("#name").value = finalName;
  $("#name").focus();
});

function download(data: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const fileBase = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "companion";
$("#dl-svg").addEventListener("click", () => {
  const rec = currentRecord();
  download(rec.svg, "image/svg+xml", `${fileBase(rec.name)}.svg`);
});
$("#dl-json").addEventListener("click", () => {
  const rec = currentRecord();
  download(metadataJSON(rec.session, rec.name), "application/json", `${fileBase(rec.name)}.json`);
});

function currentRecord(): SavedRecord {
  const minted = mintedRecord();
  if (minted) return minted;
  return { name: finalName, svg: portraitSVG(session), traits: buildTraits(session), session: structuredClone(session), hatchedAt: session.endedAt || new Date().toISOString() };
}
function renderReviewedRecord(rec: SavedRecord) {
  finalName = rec.name;
  $("#final-name").textContent = rec.name;
  $("#portrait").innerHTML = rec.svg;
  $("#portrait svg").setAttribute("role", "img");
  $("#portrait svg").setAttribute("aria-label", "Final portrait of your hatched hamster");
  const traits = JSON.parse(rec.traits) as { trait_type: string; value: string | number }[];
  $("#trait-list").innerHTML = traits.map((a) => `<li><span>${a.trait_type}</span><strong>${a.value}</strong></li>`).join("");
}
function upsert(rec: SavedRecord) {
  records = [rec, ...records.filter((r) => r.session.id !== rec.session.id)].slice(0, 30);
  try { persist(); return true; } catch { return false; }
}
const mintedRecord = () => records.find((r) => r.session.id === session.id && r.mint);
$("#save").addEventListener("click", () => {
  const existing = records.find((r) => r.session.id === session.id);
  const ok = upsert({ ...currentRecord(), mint: existing?.mint });
  $("#save").textContent = ok ? "Saved to this browser" : "Browser storage unavailable";
  renderCollection();
});

$("#again").addEventListener("click", () => {
  if (mintBusy) return;
  session = freshSession();
  phase = "ready"; resumeAt = null; finalName = "";
  $("#stage").classList.remove("hatched");
  $("#result").hidden = true;
  $("#save").textContent = "Save to this browser";
  $("#mint-status").textContent = "";
  drawLamp(); drawAnimal();
  $("#incubator").scrollIntoView({ block: "start" });
});

document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  pendingWork = 0n;
  if (phase === "running") resumeAt = null; // returning starts a 3 s countdown; no catch-up
  if (!document.hidden) poll(); else window.clearTimeout(pollTimer);
});

// ---------- Collection ----------
function renderCollection() {
  const root = $("#collection");
  root.replaceChildren();
  if (!records.length) { root.innerHTML = `<p class="empty">No companions yet. Hatch one and save it to see it here.</p>`; return; }
  for (const r of records) {
    const card = document.createElement("article");
    card.className = "saved";
    const img = document.createElement("img");
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(r.svg);
    img.alt = `Portrait of ${r.name}`;
    img.width = 200; img.height = 210;
    const h = document.createElement("h3"); h.textContent = r.name;
    const meta = document.createElement("p"); meta.className = "note";
    meta.textContent = r.mint ? `Minted as token #${r.mint.tokenId}` : `Hatched ${new Date(r.hatchedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "btn small"; btn.textContent = "Download SVG";
    btn.addEventListener("click", () => download(r.svg, "image/svg+xml", `${fileBase(r.name)}.svg`));
    card.append(img, h, meta, btn);
    root.append(card);
  }
}

// ---------- Wallet ----------
let mintBusy = false;
function renderWallet() {
  const slot = $("#wallet-slot");
  const c = W.connection();
  if (c.isConnected && c.address) {
    const wrong = c.chainId !== W.SEPOLIA_ID;
    slot.innerHTML = wrong
      ? `<button type="button" class="btn small warn" id="w-switch">Switch to Sepolia</button>`
      : `<button type="button" class="btn small" id="w-disc">${W.short(c.address)} · Disconnect</button>`;
    $("#w-switch")?.addEventListener("click", () => W.switchToSepolia().catch(() => setMintStatus("The wallet did not switch to Sepolia.")));
    $("#w-disc")?.addEventListener("click", () => W.disconnectWallet());
  } else {
    slot.innerHTML = `<button type="button" class="btn small" id="w-connect">Connect</button>`;
    $("#w-connect").addEventListener("click", openSheet);
  }
  updateMintButton();
}

let sheetReturn: HTMLElement | null = null;
function openSheet() {
  sheetReturn = document.activeElement as HTMLElement;
  const mobile = W.isMobileBrowser();
  const rows = W.walletRows().filter((r) => !mobile || r.connector.type !== "injected");
  const here = location.href;
  const root = $("#sheet-root");
  root.innerHTML = `<div class="sheet-bg" id="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-head"><h2 id="sheet-title">Connect a wallet</h2><button type="button" class="x" id="sheet-x" aria-label="Close">×</button></div>
    ${mobile ? W.OPEN_IN.map((w) => `<a class="row" href="${w.href(here)}"><span class="ic" aria-hidden="true">${w.name[0]}</span><span>Open in ${w.name}</span></a>`).join("") : ""}
    ${rows.map((r, i) => `<button type="button" class="row" data-i="${i}"><span class="ic" aria-hidden="true">${r.connector.icon ? `<img src="${r.connector.icon}" width="28" height="28" alt="">` : r.label[0]}</span><span class="row-label">${r.label}</span></button>`).join("")}
    <p class="note" id="sheet-note" role="status"></p></div></div>`;
  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); sheetReturn?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") { // keep focus inside the sheet
      const f = [...root.querySelectorAll<HTMLElement>("button,a")];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener("keydown", onKey);
  $("#sheet-bg").addEventListener("click", (e) => { if (e.target === e.currentTarget) close(); });
  $("#sheet-x").addEventListener("click", close);
  root.querySelectorAll<HTMLButtonElement>("button[data-i]").forEach((b) => b.addEventListener("click", async () => {
    const row = rows[Number(b.dataset.i)];
    root.querySelectorAll<HTMLButtonElement>("button[data-i]").forEach((x) => (x.disabled = true));
    b.querySelector(".row-label")!.textContent = `${row.label} · opening…`;
    try { await W.connectWith(row.connector); close(); }
    catch { $("#sheet-note").textContent = `${row.label} did not connect. You can try again.`; b.querySelector(".row-label")!.textContent = row.label; root.querySelectorAll<HTMLButtonElement>("button[data-i]").forEach((x) => (x.disabled = false)); }
  }));
  root.querySelector<HTMLElement>(".row")?.focus() ?? $("#sheet-x").focus();
}

function setMintStatus(html: string) { $("#mint-status").innerHTML = html; }
function updateMintButton() {
  const btn = $<HTMLButtonElement>("#mint");
  if (!btn || !reviewing) return;
  const minted = mintedRecord();
  const c = W.connection?.();
  $("#rename").hidden = !!minted;
  $<HTMLButtonElement>("#rename").disabled = mintBusy;
  $<HTMLButtonElement>("#again").disabled = mintBusy;
  if (minted) { btn.disabled = true; btn.textContent = `Minted as token #${minted.mint!.tokenId}`; return; }
  if (!W.runtime.contractAddress) { btn.disabled = true; btn.textContent = "Mint unavailable: contract not configured"; return; }
  if (mintBusy) { btn.disabled = true; return; }
  btn.disabled = false;
  btn.textContent = !c?.isConnected ? "Connect a wallet to mint" : c.chainId !== W.SEPOLIA_ID ? "Switch to Sepolia to mint" : "Mint on Sepolia";
}
const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
$("#mint").addEventListener("click", async () => {
  if (mintBusy || phase !== "hatched" || !finalName || mintedRecord()) return;
  const c = W.connection();
  if (!c.isConnected) return openSheet();
  if (c.chainId !== W.SEPOLIA_ID) { W.switchToSepolia().catch(() => setMintStatus("The wallet did not switch to Sepolia.")); return; }
  mintBusy = true; updateMintButton();
  const rec = currentRecord();
  await W.mintCompanion({ name: rec.name, svg: rec.svg, traits: rec.traits, sessionId: session.id }, (ev) => {
    const btn = $<HTMLButtonElement>("#mint");
    switch (ev.kind) {
      case "checking": btn.textContent = "Checking the contract…"; setMintStatus("Checking the Sepolia contract and this session."); break;
      case "confirm": btn.textContent = "Confirm in your wallet…"; setMintStatus("Confirm the free mint in your wallet. Sepolia test gas applies."); break;
      case "pending": btn.textContent = "Minting…"; setMintStatus(`Transaction sent. Waiting for a receipt. ${link(W.txUrl(ev.hash), "View transaction")}`); break;
      case "success":
        upsert({ ...rec, mint: { tokenId: ev.tokenId, tx: ev.hash, contract: W.runtime.contractAddress! } });
        renderReviewedRecord(currentRecord());
        renderCollection();
        setMintStatus(`Minted as token #${ev.tokenId}. ${link(W.tokenUrl(ev.tokenId), "View NFT on Etherscan")} · ${link(W.txUrl(ev.hash), "View transaction")}`); break;
      case "duplicate":
        if (ev.tokenId) upsert({ ...rec, mint: { tokenId: ev.tokenId, contract: W.runtime.contractAddress! } });
        renderReviewedRecord(currentRecord());
        renderCollection();
        setMintStatus(`This hatch was already minted${ev.tokenId ? ` as token #${ev.tokenId}. ${link(W.tokenUrl(ev.tokenId), "View NFT on Etherscan")}` : ""}. Each hatch can be minted once.`); break;
      case "rejected": setMintStatus("You declined the request in your wallet. Nothing was sent. You can mint later."); break;
      case "failed": setMintStatus(`${ev.message}${ev.hash ? ` ${link(W.txUrl(ev.hash), "View transaction")}` : ""}`); break;
    }
  });
  mintBusy = false; updateMintButton();
});

// ---------- Boot ----------
drawLamp(); drawAnimal(); renderCollection();
$("#wallet-slot").innerHTML = `<button type="button" class="btn small" id="w-connect">Connect</button>`;
$("#w-connect").addEventListener("click", () => { /* replaced once wallets are ready */ });
W.initWallet().then(() => { renderWallet(); W.onConnection(renderWallet); W.onConnectors(() => {}); }).catch(() => {});
poll();
requestAnimationFrame(frame);
