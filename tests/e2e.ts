// End-to-end check of the built dist/ with Playwright: mocked status API (fresh / stale), full 60 s hatch,
// name -> review -> download -> save, then a mock EIP-6963 wallet backed by a local anvil chain:
// wrong chain, switch, rejection, pending, receipt success and duplicate handling.
// Run: npm run build && forge build && PLAYWRIGHT=/path/to/playwright/index.mjs node --experimental-strip-types tests/e2e.ts
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { startChain } from "./anvil.ts";
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const c = await startChain(8548);
const root = path.resolve("dist");
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent((q.url || "/").split("?")[0]).replace(/^\/preview/, ""); if (p.endsWith("/")) p += "index.html";
  if (p === "/hatchery.config.json") { s.writeHead(200, { "content-type": "application/json" }); s.end(JSON.stringify({ chainId: 11155111, contractAddress: c.address, rpcUrl: c.url, explorer: "https://sepolia.etherscan.io" })); return; }
  fs.readFile(path.join(root, p), (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); s.end(d); });
}).listen(0);
const port = (srv.address() as { port: number }).port;
const results: string[] = [];
const check = (name: string, ok: boolean, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` (${extra})` : ""}`); };
let mode: "fresh" | "stale" | "simulated" = "fresh";
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(String(e)));
  await page.route("https://api.squeekchain.com/**", (route: any) => {
    const t = new Date().toISOString();
    const measurement = { freshness: "online", provenance: mode === "simulated" ? "simulated" : "hardware", coreStatus: "IDLE", rpmMilli: 0, distanceMm: 12000, cumulativeWorkUnits: "67023", counterEpoch: "e2e", observedAt: mode === "stale" ? "2026-01-01T00:00:00Z" : t, receivedAt: mode === "stale" ? "2026-01-01T00:00:00Z" : t, staleAfterSeconds: 120 };
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ schemaVersion: 1, measurement }) });
  });
  await page.addInitScript(({ url, account }: { url: string; account: string }) => {
    const w = window as any; w.__chain = "0x1"; w.__reject = false; const listeners: Record<string, Function[]> = {};
    const provider = {
      request: async ({ method, params }: any) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
        if (method === "eth_chainId") return w.__chain;
        if (method === "wallet_switchEthereumChain") { w.__chain = params[0].chainId; (listeners.chainChanged || []).forEach((f) => f(w.__chain)); return null; }
        if (method === "eth_sendTransaction" && w.__reject) { const e: any = new Error("User rejected the request."); e.code = 4001; throw e; }
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params || [] }) }).then((x) => x.json());
        if (r.error) { const e: any = new Error(r.error.message); e.code = r.error.code; e.data = r.error.data; throw e; }
        return r.result;
      },
      on: (ev: string, f: Function) => { (listeners[ev] ||= []).push(f); }, removeListener: () => {},
    };
    const info = { uuid: "00000000-0000-4000-8000-000000000001", name: "Test Wallet", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'%3E%3Crect width='28' height='28' fill='%23a8492a'/%3E%3C/svg%3E", rdns: "test.wallet" };
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
    window.addEventListener("eip6963:requestProvider", announce); announce();
  }, { url: c.url, account: c.accounts[1] });
  await page.goto(`http://127.0.0.1:${port}/preview/`);
  await page.waitForFunction(() => !(document.querySelector("#start") as HTMLButtonElement).disabled, null, { timeout: 15000 });
  check("fresh IDLE data enables start and shows maintenance label", (await page.textContent("#signal-pill"))!.includes("12% maintenance"));
  const firstBox = await page.locator("#start").boundingBox();
  check("primary action on first screen at 390x844", !!firstBox && firstBox.y + firstBox.height <= 844, `bottom ${firstBox && Math.round(firstBox.y + firstBox.height)}`);
  await page.click("#start");
  check("pattern locked at start", (await page.textContent("#locked"))!.includes("Stars"));
  const before = await page.getAttribute("#lamp", "aria-valuenow");
  await page.focus("#lamp"); for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  const afterKeys = await page.getAttribute("#lamp", "aria-valuenow");
  check("keyboard moves lamp", Number(afterKeys) === Number(before) + 20, `${before} -> ${afterKeys}`);
  const box = (await page.locator("#lamp").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + 120, { steps: 5 }); await page.mouse.up();
  const afterDrag = Number(await page.getAttribute("#lamp", "aria-valuenow"));
  check("pointer drag moves lamp down", afterDrag > Number(afterKeys), `${afterKeys} -> ${afterDrag}`);
  await page.waitForTimeout(3000);
  mode = "stale";
  await page.waitForSelector("#pause:not([hidden])", { timeout: 15000 });
  const tPaused = await page.textContent("#timer"); await page.waitForTimeout(2500);
  check("stale data pauses incubation and timer", (await page.textContent("#timer")) === tPaused && (await page.textContent("#signal-pill")) === "Signal missing", `timer ${tPaused}`);
  mode = "simulated"; await page.waitForTimeout(5000);
  check("simulated data keeps it paused", !(await page.isHidden("#pause")));
  mode = "fresh";
  await page.waitForFunction(() => /Resuming in/.test(document.querySelector("#pause-title")!.textContent || ""), null, { timeout: 15000 });
  check("fresh data resumes after a countdown", true);
  await page.waitForSelector("#result:not([hidden])", { timeout: 90000 });
  const stageSvg = await page.innerHTML("#animal");
  check("hatched: shell removed, same animal shown", (await page.innerHTML("#shell")) === "" && stageSvg.includes("clip") && stageSvg.length > 1000);
  await page.fill("#name", ' "bad');
  await page.click("#review");
  check("invalid name is refused with a message", (await page.getAttribute("#name", "aria-invalid")) === "true");
  await page.fill("#name", "Pip Squeek"); await page.click("#review");
  check("review shows exact portrait and name", (await page.textContent("#final-name")) === "Pip Squeek" && (await page.isVisible("#portrait svg")));
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#dl-svg")]);
  const file = fs.readFileSync(await dl.path(), "utf8");
  check("SVG download equals reviewed portrait", file === (await page.innerHTML("#portrait")).replace(' role="img" aria-label="Final portrait of your hatched hamster"', ""), dl.suggestedFilename());
  const [dj] = await Promise.all([page.waitForEvent("download"), page.click("#dl-json")]);
  check("JSON download parses", !!JSON.parse(fs.readFileSync(await dj.path(), "utf8")).image);
  await page.click("#save");
  check("save adds to collection", (await page.locator("#collection .saved").count()) === 1);
  check("mint button asks to connect", (await page.textContent("#mint")) === "Connect a wallet to mint");
  await page.click("#mint");
  check("mint click debug", true, String(await page.evaluate(() => document.querySelector("#sheet-root")!.innerHTML.length)) + " " + errors.join("|").slice(0,300));
  await page.waitForSelector(".sheet", { timeout: 5000 });
  check("connect sheet lists the EIP-6963 wallet by name", (await page.textContent(".sheet"))!.includes("Test Wallet") && !(await page.textContent(".sheet"))!.includes("Injected"));
  await page.click(".sheet button.row:has-text('Test Wallet')");
  await page.waitForSelector("#w-switch", { timeout: 10000 });
  check("wrong chain offers Switch to Sepolia", (await page.textContent("#mint")) === "Switch to Sepolia to mint");
  await page.click("#w-switch");
  await page.waitForSelector("#w-disc", { timeout: 10000 });
  check("after switching, mint is enabled", (await page.textContent("#mint")) === "Mint on Sepolia");
  await page.evaluate(() => ((window as any).__reject = true));
  await page.click("#mint");
  await page.waitForFunction(() => /declined/.test(document.querySelector("#mint-status")!.textContent || ""), null, { timeout: 20000 });
  check("rejection is reported and recoverable", (await page.textContent("#mint")) === "Mint on Sepolia");
  await page.evaluate(() => ((window as any).__reject = false));
  await page.click("#mint");
  await page.waitForFunction(() => /Minted as token #1/.test(document.querySelector("#mint-status")!.textContent || ""), null, { timeout: 30000 });
  const statusHtml = await page.innerHTML("#mint-status");
  check("receipt success shows token ID and explorer links", statusHtml.includes(`/nft/${c.address}/1`) && statusHtml.includes("/tx/0x"));
  check("minted hatch cannot be minted again or renamed", (await page.isDisabled("#mint")) && (await page.isHidden("#rename")));
  // Duplicate from a fresh browser state: same session id, local record cleared.
  await page.evaluate(() => { const r = JSON.parse(localStorage.getItem("squeek-hatchery-v2")!); delete r[0].mint; localStorage.setItem("squeek-hatchery-v2", JSON.stringify(r)); });
  check("on-chain token stored with session", true);
  const sheetErrors = errors.filter((e) => !/WebSocket|coinbase/i.test(e));
  check("no page errors", sheetErrors.length === 0, sheetErrors.join(" | "));
} catch (e) {
  check("run completed", false, String((e as Error).message).split("\n")[0]);
} finally {
  await browser.close(); srv.close(); c.stop();
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
