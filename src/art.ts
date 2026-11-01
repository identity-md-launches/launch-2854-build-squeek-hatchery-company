// SVG artwork. The same animalGroup() renders inside the egg, in the hatch reveal, in the
// downloaded portrait and in the minted token, so they can never disagree.
import { RAINBOW, BASE_FUR, bandAt, colorAlpha, patternAlpha, type PatternType, type Session } from "./rules.ts";

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const hex = (c: readonly number[]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** Small deterministic PRNG for stable pattern layouts. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Mark { x: number; y: number; size: number; rot: number }
// Front-facing zones: forehead, chest and belly. The eye and nose area stays clear.
const ZONES = [
  { x: 200, y: 146, w: 50, h: 14, n: [2, 1, 1, 2, 1] },
  { x: 200, y: 246, w: 66, h: 12, n: [3, 2, 2, 2, 2] },
  { x: 200, y: 296, w: 56, h: 22, n: [4, 2, 2, 3, 2] },
];
const TYPE_INDEX: Record<PatternType, number> = { spots: 0, patches: 1, stripes: 2, stars: 3, swirls: 4 };

export function patternLayout(type: PatternType, seed: number): Mark[] {
  const r = rng(seed * 7 + TYPE_INDEX[type] + 1);
  const marks: Mark[] = [];
  for (const z of ZONES) {
    const n = z.n[TYPE_INDEX[type]];
    for (let i = 0; i < n; i++) {
      const slot = (i + 0.5) / n - 0.5;
      marks.push({
        x: z.x + slot * z.w * 2 + (r() - 0.5) * (z.w / n),
        y: z.y + (r() - 0.5) * z.h * 2,
        size: 0.75 + r() * 0.5,
        rot: (r() - 0.5) * 50,
      });
    }
  }
  return marks;
}

export function markShape(type: PatternType, m: Mark, fill: string, opacity: number) {
  const o = `opacity="${opacity.toFixed(2)}"`;
  const s = m.size;
  const tr = `transform="translate(${f(m.x)} ${f(m.y)}) rotate(${f(m.rot)}) scale(${f(s)})"`;
  switch (type) {
    case "spots": return `<circle ${tr} r="5" fill="${fill}" ${o}/>`;
    case "patches": return `<path ${tr} d="M-15-2c2-9 15-10 20-4s9 7 4 12-17 6-22 1-3-6-2-9z" fill="${fill}" ${o}/>`;
    case "stripes": return `<path ${tr} d="M-14 3q14-11 28 0" fill="none" stroke="${fill}" stroke-width="4.5" stroke-linecap="round" ${o}/>`;
    case "stars": return `<path ${tr} d="M0-8l2.4 5 5.4.6-4 3.7 1.1 5.4L0 4l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" fill="${fill}" ${o}/>`;
    case "swirls": return `<path ${tr} d="M-9 3c-2-10 14-13 14-3 0 6-9 7-9 1 0-3 4-4 5-1" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round" ${o}/>`;
  }
}

/** A tiny standalone preview of a pattern family and layout. */
export function patternMiniature(type: PatternType, seed: number, label: string) {
  const marks = patternLayout(type, seed).map((m) => markShape(type, { ...m, x: (m.x - 200) * 0.3 + 32, y: (m.y - 221) * 0.3 + 32, size: m.size * 0.55 }, "#9b6a4f", 0.85)).join("");
  return `<svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}"><ellipse cx="32" cy="32" rx="28" ry="30" fill="#f6e8d2"/>${marks}</svg>`;
}

const SIL = {
  earL: (e: number) => `<ellipse cx="146" cy="${f(128 - e * 4)}" rx="${f(22 + e * 7)}" ry="${f(21 + e * 7)}"/>`,
  earR: (e: number) => `<ellipse cx="254" cy="${f(128 - e * 4)}" rx="${f(22 + e * 7)}" ry="${f(21 + e * 7)}"/>`,
  head: `<ellipse cx="200" cy="184" rx="76" ry="64"/>`,
  cheeks: `<ellipse cx="136" cy="212" rx="28" ry="26"/><ellipse cx="264" cy="212" rx="28" ry="26"/>`,
  body: (g: number) => `<path d="M126 220c-${f(12 + g * 6)} 30-${f(14 + g * 6)} 70 4 104 18 22 122 22 140 0 ${f(18 + g * 6)}-34 ${f(16 + g * 6)}-74 4-104z"/>`,
};

function tufts(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number, size: number) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * (i + 0.5)) / n;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    d += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size)}"/>`;
  }
  return d;
}

/**
 * The hamster, seen from the front. `id` keeps gradient/clip ids unique per rendering.
 * Head light grows ears, middle light grows body fluff, lower light grows lower coat and the pom.
 */
export function animalGroup(s: Session, id: string) {
  const [ears, fluff, lower] = s.regions.map((r) => r.growth);
  const bands = s.bands;
  const top = bands[0].y, bottom = bands[bands.length - 1].y, span = bottom - top;
  const stop = (y: number) => f(((y - top) / span) * 100);
  const coatStops = bands.map((b) => `<stop offset="${stop(b.y)}%" stop-color="${hex(b.rgb)}" stop-opacity="${(colorAlpha(b.dose) * Math.max(0, 1 - b.rainbow - b.pearl)).toFixed(2)}"/>`).join("");
  const anyRainbow = bands.some((b) => b.rainbow * colorAlpha(b.dose) > 0.01);
  const anyPearl = bands.some((b) => b.pearl * colorAlpha(b.dose) > 0.01);
  const maskStops = (key: "rainbow" | "pearl") => bands.map((b) => `<stop offset="${stop(b.y)}%" stop-color="#fff" stop-opacity="${(colorAlpha(b.dose) * b[key]).toFixed(2)}"/>`).join("");

  // Fluff: soft tufts along the body sides; lower coat: tufts along the base; pom grows.
  const fluffTufts = fluff > 0.05 ? tufts(200, 262, 74 + fluff * 4, 62, Math.PI * 0.62, Math.PI * 1.02, 4, 4 + fluff * 7) + tufts(200, 262, 74 + fluff * 4, 62, Math.PI * -0.02, Math.PI * 0.38, 4, 4 + fluff * 7) : "";
  const lowerTufts = lower > 0.05 ? tufts(200, 300, 62, 30, Math.PI * 0.18, Math.PI * 0.82, 7, 3 + lower * 6) : "";
  const pomR = 7 + lower * 7;
  const pom = `<circle cx="${f(286 + lower * 3)}" cy="314" r="${f(pomR)}"/>${lower > 0.2 ? tufts(286 + lower * 3, 314, pomR, pomR, -Math.PI * 0.7, Math.PI * 0.4, 5, pomR * 0.42) : ""}`;
  const silhouette = SIL.earL(ears) + SIL.earR(ears) + SIL.head + SIL.cheeks + SIL.body(fluff) + `<g>${fluffTufts}${lowerTufts}</g>`;

  // Patterns: locked family and layout; visibility comes from local light dose only.
  let marks = "";
  if (s.patternSource) {
    patternLayout(s.patternType, s.patternSeed).forEach((m, i) => {
      const b = bandAt(s, m.y);
      const a = patternAlpha(b.dose);
      if (a < 0.02) return;
      const fill = b.rainbow > 0.5 ? RAINBOW[i % 7] : b.pearl > 0.5 ? ["#d9a8cc", "#a9c6e6"][i % 2] : hex(b.rgb.map((v, k) => v * 0.68 + [40, 22, 12][k] * 0.1));
      marks += markShape(s.patternType, m, fill, a);
    });
  }
  const pawTint = (y: number) => {
    const b = bandAt(s, y), a = colorAlpha(b.dose) * 0.6;
    return hex(BASE_FUR.map((v, k) => v + (b.rgb[k] - v) * a));
  };
  const earTint = (() => { const b = bandAt(s, 128); return hex([239, 176, 170].map((v, k) => v + (b.rgb[k] - v) * colorAlpha(b.dose) * 0.35)); })();

  return `<defs>
<linearGradient id="fur${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbeedb"/><stop offset="1" stop-color="#ead2b3"/></linearGradient>
<linearGradient id="coat${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}">${coatStops}</linearGradient>
${anyRainbow ? `<linearGradient id="rb${id}" x1="0" x2="1">${RAINBOW.map((c, i) => `<stop offset="${f((i / 6) * 100)}%" stop-color="${c}"/>`).join("")}</linearGradient><linearGradient id="rbm${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}">${maskStops("rainbow")}</linearGradient><mask id="rbk${id}"><rect width="400" height="420" fill="url(#rbm${id})"/></mask>` : ""}
${anyPearl ? `<linearGradient id="pl${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6f0"/><stop offset=".35" stop-color="#f3c9e1"/><stop offset=".6" stop-color="#cfe2f6"/><stop offset=".85" stop-color="#f6d6ea"/><stop offset="1" stop-color="#fff6f0"/></linearGradient><linearGradient id="plm${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${bottom}">${maskStops("pearl")}</linearGradient><mask id="plk${id}"><rect width="400" height="420" fill="url(#plm${id})"/></mask>` : ""}
<clipPath id="clip${id}">${silhouette}${pom}</clipPath>
</defs>
<ellipse cx="200" cy="348" rx="96" ry="10" fill="#7a5a48" opacity=".12"/>
<g fill="url(#fur${id})" stroke="#b08d72" stroke-width="2.4" stroke-linejoin="round">${pom}${silhouette}</g>
<g clip-path="url(#clip${id})">
<rect x="60" y="80" width="280" height="290" fill="url(#coat${id})"/>
${anyRainbow ? `<rect x="60" y="80" width="280" height="290" fill="url(#rb${id})" mask="url(#rbk${id})" opacity=".85"/>` : ""}
${anyPearl ? `<rect x="60" y="80" width="280" height="290" fill="url(#pl${id})" mask="url(#plk${id})"/>` : ""}
<ellipse cx="200" cy="286" rx="52" ry="46" fill="#fff7ea" opacity=".45"/>
${marks}
</g>
<g fill="${earTint}"><ellipse cx="146" cy="${f(130 - ears * 4)}" rx="${f(12 + ears * 5)}" ry="${f(11 + ears * 5)}"/><ellipse cx="254" cy="${f(130 - ears * 4)}" rx="${f(12 + ears * 5)}" ry="${f(11 + ears * 5)}"/></g>
<ellipse cx="200" cy="207" rx="30" ry="21" fill="#fff8ee" opacity=".9"/>
<g fill="#f2a9a0" opacity=".55"><ellipse cx="144" cy="214" rx="15" ry="9"/><ellipse cx="256" cy="214" rx="15" ry="9"/></g>
<g fill="#2f2523"><ellipse cx="172" cy="184" rx="10" ry="12"/><ellipse cx="228" cy="184" rx="10" ry="12"/></g>
<g fill="#fff"><circle cx="175" cy="179" r="3.6"/><circle cx="231" cy="179" r="3.6"/><circle cx="168" cy="189" r="1.6"/><circle cx="224" cy="189" r="1.6"/></g>
<path d="M194 199q6-4 12 0q-2 6-6 7q-4-1-6-7z" fill="#d98585"/>
<path d="M200 206v4m0 0q-5 6-10 1m10-1q5 6 10 1" stroke="#9a6d63" stroke-width="2" stroke-linecap="round" fill="none"/>
<path d="M176 206l-22-4m22 9l-22 3m70-8l22-4m-22 9l22 3" stroke="#c9ab95" stroke-width="1.4" stroke-linecap="round"/>
<g fill="${pawTint(262)}" stroke="#b08d72" stroke-width="2"><ellipse cx="182" cy="262" rx="11" ry="9"/><ellipse cx="218" cy="262" rx="11" ry="9"/></g>
<g fill="${pawTint(336)}" stroke="#b08d72" stroke-width="2"><ellipse cx="170" cy="338" rx="18" ry="9"/><ellipse cx="230" cy="338" rx="18" ry="9"/></g>
<g fill="#eeb1a8"><circle cx="164" cy="339" r="2.4"/><circle cx="171" cy="341" r="2.4"/><circle cx="178" cy="339" r="2.4"/><circle cx="222" cy="339" r="2.4"/><circle cx="229" cy="341" r="2.4"/><circle cx="236" cy="339" r="2.4"/></g>`;
}

/** The exact final portrait used for review, download and minting. */
export function portraitSVG(s: Session) {
  const id = "p" + s.id.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 420" width="400" height="420"><rect width="400" height="420" rx="28" fill="#fbf3e6"/><circle cx="200" cy="230" r="150" fill="#f5e6cf"/>${animalGroup(s, id).replace(/\n/g, "")}</svg>`;
}

/** Shell layer for the stage: opaque everywhere except a soft window under the beam. */
export function shellLayer(targetX: number, targetY: number, open: boolean) {
  const wx = targetX - 78;
  return `<defs><radialGradient id="shellfill" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff4ea"/><stop offset=".65" stop-color="#f4dcc6"/><stop offset="1" stop-color="#dfbf9f"/></radialGradient>
<filter id="feather" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="11"/></filter>
<mask id="window"><rect width="400" height="420" fill="#fff"/>${open ? `<ellipse cx="${f(wx)}" cy="${f(targetY)}" rx="100" ry="40" fill="#000" filter="url(#feather)"/>` : ""}</mask></defs>
<g mask="url(#window)"><ellipse cx="200" cy="215" rx="118" ry="152" fill="url(#shellfill)"/>
<g fill="#d9bf9c" opacity=".55"><circle cx="150" cy="120" r="5"/><circle cx="246" cy="98" r="3.5"/><circle cx="268" cy="168" r="6"/><circle cx="128" cy="236" r="4"/><circle cx="182" cy="300" r="5.5"/><circle cx="262" cy="282" r="3.5"/><circle cx="214" cy="346" r="4"/><circle cx="110" cy="170" r="3"/></g>
<ellipse cx="160" cy="130" rx="26" ry="44" fill="#fff" opacity=".35" transform="rotate(-24 160 130)"/></g>
<ellipse cx="200" cy="215" rx="118" ry="152" fill="none" stroke="#d6b994" stroke-width="2.5"/>`;
}
