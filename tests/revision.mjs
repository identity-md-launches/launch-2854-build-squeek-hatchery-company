// Built-export regressions for the reopened findings. Test fixtures are never public data.
// PLAYWRIGHT=/absolute/path/to/playwright/index.mjs node tests/revision.mjs [export directory]
// Optional: MINT_CHAIN=1 includes the real ERC721 on an isolated Anvil chain (see VALIDATION.md).
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium, webkit } = await import(process.env.PLAYWRIGHT || 'playwright');
const root = path.resolve(process.argv[2] || 'dist');
const shots = path.resolve('test/scratch/revision');
await fs.mkdir(shots, { recursive: true });
const portReservation = process.env.MINT_CHAIN ? http.createServer() : null;
if (portReservation) await new Promise(resolve => portReservation.listen(0, '127.0.0.1', resolve));
const chainPort = portReservation?.address().port;
if (portReservation) await new Promise(resolve => portReservation.close(resolve));
const chain = process.env.MINT_CHAIN ? await (await import('./anvil.ts')).startChain(chainPort) : null;
if (chain) {
  // Sepolia's batching helper also needs to exist on the isolated test chain.
  const { multicall3Bytecode } = await import(new URL('./constants/contracts.js', import.meta.resolve('viem')).href);
  const hash = await chain.wallet(chain.accounts[0]).deployContract({ abi: [], bytecode: multicall3Bytecode, chain: null });
  const receipt = await chain.pub.waitForTransactionReceipt({ hash });
  const code = await chain.pub.getCode({ address: receipt.contractAddress });
  const { sepolia } = await import('viem/chains');
  await chain.pub.request({ method: 'anvil_setCode', params: [sepolia.contracts.multicall3.address, code] });
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer(async (q, s) => {
  const url = new URL(q.url, 'http://localhost');
  let file = url.pathname.replace(/^\/preview\//, '');
  if (!file) file = 'index.html';
  if (chain && file === 'hatchery.config.json') {
    s.writeHead(200, { 'content-type': 'application/json' });
    return s.end(JSON.stringify({ chainId: 11155111, contractAddress: chain.address, rpcUrl: chain.url, explorer: 'https://sepolia.etherscan.io' }));
  }
  try {
    const bytes = await fs.readFile(path.join(root, file));
    s.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); s.end(bytes);
  } catch { s.writeHead(404); s.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const browsers = [];
async function check(name, run) {
  if (process.env.CHECK_FILTER && !new RegExp(process.env.CHECK_FILTER).test(name)) return;
  try { const evidence = await run(); results.push({ name, passed: true, evidence }); }
  catch (error) { results.push({ name, passed: false, evidence: error.message }); }
  console.log(JSON.stringify(results.at(-1)));
}
function body(time, overrides = {}) {
  return { schemaVersion: 1, measurement: { freshness: 'online', provenance: 'hardware', coreStatus: 'IDLE', rpmMilli: 0, distanceMm: 12000, cumulativeWorkUnits: '1000', counterEpoch: 'review-epoch', observedAt: new Date(time).toISOString(), receivedAt: new Date(time).toISOString(), staleAfterSeconds: 120, ...overrides } };
}
async function fixture(browser, width = 390, wallet = false) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const state = { mode: 'fresh', count: 0, work: '1000', distanceMm: 12000, epoch: 'review-epoch', observedAt: null };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('Browser diagnostic: ' + message.text()); });
  await page.route('https://api.squeekchain.com/**', async route => {
    state.count++;
    if (state.mode === 'network') return route.abort('failed');
    const now = await page.evaluate(() => Date.now());
    const data = body(now, { cumulativeWorkUnits: state.work, distanceMm: state.distanceMm, counterEpoch: state.epoch });
    if (state.observedAt !== null) data.measurement.observedAt = new Date(state.observedAt).toISOString();
    if (state.mode === 'stale') data.measurement.receivedAt = new Date(now - 200_000).toISOString();
    if (state.mode === 'simulated') data.measurement.provenance = 'simulated';
    if (state.mode === 'fault') data.measurement.coreStatus = 'COUNTER_FAULT';
    await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });
  });
  if (wallet) await page.addInitScript(({ rpc, account }) => {
    window.__chain = '0x1'; window.__walletMode = 'normal'; window.__sendCount = 0; window.__authorized = false;
    const listeners = {};
    window.__setChain = chainId => { window.__chain = chainId; (listeners.chainChanged || []).forEach(fn => fn(chainId)); };
    const provider = {
      async request({ method, params = [] }) {
        if (method === 'eth_requestAccounts') { window.__authorized = true; return [account]; }
        if (method === 'eth_accounts') return window.__authorized ? [account] : [];
        if (method === 'eth_chainId') return window.__chain;
        if (method === 'wallet_switchEthereumChain') {
          window.__setChain(params[0].chainId); return null;
        }
        if (method === 'eth_sendTransaction') {
          window.__sendCount++;
          if (window.__walletMode === 'hold') await new Promise(resolve => { window.__releaseWallet = resolve; });
          if (window.__walletMode === 'reject') throw Object.assign(new Error('User rejected the request'), { code: 4001 });
          if (window.__walletMode === 'fail') throw Object.assign(new Error('Test RPC unavailable'), { code: -32000 });
        }
        const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then(r => r.json());
        if (response.error) throw Object.assign(new Error(response.error.message), response.error);
        return response.result;
      },
      on(event, fn) { (listeners[event] ||= []).push(fn); },
      removeListener(event, fn) { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
    };
    const info = { uuid: '00000000-0000-4000-8000-000000000001', name: 'Revision Test Wallet', rdns: 'test.wallet', icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Ccircle cx="14" cy="14" r="12" fill="%23a8492a"/%3E%3C/svg%3E' };
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
    window.addEventListener('eip6963:requestProvider', announce); announce();
  }, { rpc: chain.url, account: chain.accounts[1] });
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto(url);
  for (let i = 0; i < 20 && await page.locator('#start').isDisabled(); i++) {
    await page.clock.runFor(100); await page.waitForTimeout(25);
  }
  await page.waitForFunction(() => !document.querySelector('#start').disabled);
  return { page, context, state, errors };
}
async function advance(page, ms) {
  for (let t = 0; t < ms; t += 1000) { await page.clock.runFor(Math.min(1000, ms - t)); await page.waitForTimeout(15); }
}
async function nextPoll(f) {
  const before = f.state.count;
  for (let i = 0; i < 75 && f.state.count === before; i++) await advance(f.page, 1000);
  assert.ok(f.state.count > before, 'poll must arrive');
  await f.page.waitForTimeout(50);
  await f.page.clock.runFor(100);
}
const timer = page => page.textContent('#timer');
async function hatch(f, name) {
  await f.page.click('#start');
  await advance(f.page, 61_000);
  await f.page.locator('#name').waitFor({ state: 'visible' });
  await f.page.fill('#name', name); await f.page.click('#review');
}
async function layout(page) {
  return page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, name: document.querySelector('#final-name')?.textContent, work: document.querySelector('#work')?.textContent, nameWidth: document.querySelector('#final-name')?.getBoundingClientRect().width }));
}
async function download(page, selector) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  return fs.readFile(await file.path(), 'utf8');
}
try {
  const browser = await chromium.launch(); browsers.push(browser);
  if (!process.env.MINT_ONLY) {
  await check('Repeated older readings never regain usable signal or advance incubation', async () => {
    const f = await fixture(browser);
    await f.page.click('#start'); await advance(f.page, 3100);
    f.state.observedAt = (await f.page.evaluate(() => Date.now())) - 4100; f.state.work = '900';
    await nextPoll(f);
    const stopped = await timer(f.page);
    assert.match(await f.page.textContent('#signal-state'), /replayed/);
    for (let i = 0; i < 3; i++) await nextPoll(f);
    await advance(f.page, 4000);
    const actual = { stopped, after: await timer(f.page), work: await f.page.textContent('#work'), polls: f.state.count };
    await f.page.screenshot({ path: path.join(shots, 'replay-390.png') });
    assert.equal(actual.after, stopped, JSON.stringify(actual));
    assert.equal(actual.work, 'Unavailable');
    f.state.observedAt = null; f.state.work = '1001'; await nextPoll(f);
    assert.match(await f.page.textContent('#pause-title'), /Resuming in/);
    await advance(f.page, 2000); assert.equal(await timer(f.page), stopped);
    await advance(f.page, 2500); assert.notEqual(await timer(f.page), stopped);
    assert.match(await f.page.textContent('#locked'), /Locked at 1,000/);
    await f.context.close(); return actual;
  });
  for (const mode of ['network', 'stale', 'simulated', 'fault']) await check(`Replay baseline survives ${mode} interruption and accepts an epoch reset`, async () => {
    const f = await fixture(browser); await f.page.click('#start'); await advance(f.page, 2000);
    f.state.mode = mode; await nextPoll(f); const stopped = await timer(f.page);
    f.state.mode = 'fresh'; f.state.work = '900'; await nextPoll(f); await advance(f.page, 4000);
    assert.equal(await timer(f.page), stopped); assert.equal(await f.page.textContent('#work'), 'Unavailable');
    f.state.epoch = 'new-epoch'; f.state.work = '1'; await nextPoll(f);
    assert.match(await f.page.textContent('#pause-title'), /Resuming in/);
    await advance(f.page, 4500); assert.notEqual(await timer(f.page), stopped);
    assert.match(await f.page.textContent('#locked'), /Locked at 1,000/);
    await f.context.close(); return { stopped, epochResetResumes: true };
  });
  await check('30-character name and saved name reflow at 320, 390, 768, 1440', async () => {
    const f = await fixture(browser); const name = 'W'.repeat(30); await hatch(f, name); await f.page.click('#save');
    const measurements = [];
    for (const width of [320, 390, 768, 1440]) {
      await f.page.setViewportSize({ width, height: 844 });
      const value = await layout(f.page); measurements.push(value);
      await f.page.screenshot({ path: path.join(shots, `name-${width}.png`), fullPage: true });
      assert.equal(value.name, name); assert.equal(await f.page.textContent('.saved h3'), name);
      assert.equal(value.scroll, width, JSON.stringify(measurements));
    }
    const metadata = JSON.parse(await download(f.page, '#dl-json')); assert.equal(metadata.name, name);
    const svg = await download(f.page, '#dl-svg'); assert.equal(Buffer.from(metadata.image.split(',')[1], 'base64').toString(), svg);
    assert.equal(await f.page.evaluate(svg => {
      const actual = document.querySelector('#portrait svg').cloneNode(true);
      actual.removeAttribute('role'); actual.removeAttribute('aria-label');
      const expected = document.createElement('div'); expected.innerHTML = svg;
      return actual.isEqualNode(expected.firstElementChild);
    }, svg), true, 'Downloaded SVG must equal the reviewed portrait DOM');
    assert.equal(f.errors.length, 0, f.errors.join('\n'));
    await f.context.close(); return measurements;
  });
  for (const work of ['9007199254740993000', '9'.repeat(78)]) await check(`Exact ${work.length}-digit work counter reflows at 320 and 390`, async () => {
    const f = await fixture(browser, 320); f.state.work = work; await nextPoll(f);
    const measurements = [];
    for (const width of [320, 390]) {
      await f.page.setViewportSize({ width, height: 844 });
      await advance(f.page, 100);
      let value = await layout(f.page); measurements.push(value);
      assert.equal(value.work, BigInt(work).toLocaleString('en-US'));
      assert.equal(value.scroll, width, JSON.stringify(measurements));
      if (await f.page.isVisible('#start')) await f.page.click('#start');
      await advance(f.page, 100);
      value = await layout(f.page); assert.equal(value.scroll, width, JSON.stringify(value));
      await f.page.screenshot({ path: path.join(shots, `counter-${work.length}-${width}.png`), fullPage: true });
    }
    await f.context.close(); return measurements;
  });
  }
  if (chain) await check('Mint freezes review during checking, signing and pending; names, SVG and traits match receipt metadata', async () => {
    const f = await fixture(browser, 390, true); await hatch(f, 'Original Pip');
    await f.page.clock.resume();
    console.log('Mint fixture ready: ' + await f.page.textContent('#mint') + '; ' + await f.page.textContent('#wallet-slot'));
    await f.page.click('#mint'); await f.page.locator('.sheet').waitFor();
    await f.page.getByRole('button', { name: 'Revision Test Wallet' }).click();
    await f.page.locator('.sheet').waitFor({ state: 'hidden' });
    await f.page.evaluate(() => window.__setChain('0x1'));
    await f.page.locator('#w-switch').waitFor(); await f.page.click('#w-switch'); await f.page.locator('#w-disc').waitFor();
    for (const mode of ['reject', 'fail']) {
      await f.page.evaluate(mode => { window.__walletMode = mode; }, mode);
      await f.page.click('#mint');
      for (let i = 0; i < 20 && await f.page.isDisabled('#mint'); i++) { await advance(f.page, 1000); await f.page.waitForTimeout(100); }
      assert.equal(await f.page.isDisabled('#rename'), false);
      assert.match(await f.page.textContent('#mint-status'), mode === 'reject' ? /declined/ : /unavailable|complete|RPC|parameters/);
    }
    await f.page.evaluate(() => { window.__walletMode = 'hold'; });
    await f.page.click('#mint');
    // Observe the guard as soon as the checking request starts.
    const checkingDisabled = await f.page.isDisabled('#rename');
    await f.page.waitForFunction(() => typeof window.__releaseWallet === 'function', null, { timeout: 15000 });
    const signingDisabled = await f.page.isDisabled('#rename');
    if (!signingDisabled) {
      await f.page.click('#rename'); await f.page.fill('#name', 'Changed Pip'); await f.page.click('#review');
    } else {
      // Even direct event dispatch must not bypass the flow guard.
      await f.page.locator('#rename').dispatchEvent('click');
      await f.page.locator('#name-form').dispatchEvent('submit');
      await f.page.locator('#again').dispatchEvent('click');
      assert.equal(await f.page.isHidden('#name-form'), true);
    }
    const pendingJson = JSON.parse(await download(f.page, '#dl-json'));
    const sendsBefore = await f.page.evaluate(() => window.__sendCount);
    await f.page.locator('#mint').dispatchEvent('click');
    assert.equal(await f.page.evaluate(() => window.__sendCount), sendsBefore, 'Repeated mint must not send a second transaction');
    const { createTestClient, http: transport } = await import('viem');
    const anvil = createTestClient({ mode: 'anvil', transport: transport(chain.url) });
    await anvil.setAutomine(false);
    await f.page.evaluate(() => { window.__walletMode = 'normal'; window.__releaseWallet(); });
    await f.page.waitForFunction(() => /Waiting for a receipt/.test(document.querySelector('#mint-status').textContent), null, { timeout: 15000 });
    const pendingDisabled = await f.page.isDisabled('#rename');
    await anvil.mine({ blocks: 1 }); await anvil.setAutomine(true);
    for (let i = 0; i < 20 && !(await f.page.textContent('#mint-status')).includes('Minted as token #1'); i++) { await advance(f.page, 1000); await f.page.waitForTimeout(100); }
    const uri = await chain.pub.readContract({ address: chain.address, abi: chain.abi, functionName: 'tokenURI', args: [1n] });
    const token = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
    const metadata = JSON.parse(await download(f.page, '#dl-json'));
    const svg = await download(f.page, '#dl-svg');
    const reviewName = await f.page.textContent('#final-name');
    const collectionName = await f.page.textContent('.saved h3');
    const evidence = { checkingDisabled, signingDisabled, pendingDisabled, tokenName: token.name, reviewName, downloadName: metadata.name, collectionName };
    await f.page.screenshot({ path: path.join(shots, 'mint-390.png'), fullPage: true });
    assert.equal(reviewName, token.name, JSON.stringify(evidence));
    assert.equal(collectionName, token.name); assert.deepEqual(metadata, token); assert.deepEqual(pendingJson, token);
    assert.equal(Buffer.from(token.image.split(',')[1], 'base64').toString(), svg);
    assert.ok(checkingDisabled && signingDisabled && pendingDisabled, JSON.stringify(evidence));
    assert.equal(await f.page.isHidden('#rename'), true); assert.equal(await f.page.isDisabled('#mint'), true);
    const saved = await f.page.evaluate(() => JSON.parse(localStorage.getItem('squeek-hatchery-v2'))[0]);
    const { keccak256, toBytes } = await import('viem');
    const sid = keccak256(toBytes(saved.session.id));
    assert.equal(await chain.pub.readContract({ address: chain.address, abi: chain.abi, functionName: 'tokenOfSession', args: [sid] }), 1n);
    await assert.rejects(chain.pub.simulateContract({ account: chain.accounts[2], address: chain.address, abi: chain.abi, functionName: 'mint', args: [token.name, svg, JSON.stringify(token.attributes), sid] }), /AlreadyMinted/);
    assert.equal(f.errors.length, 0, f.errors.join('\n'));
    await f.context.close(); return evidence;
  });
  if (process.env.WEBKIT) await check('WebKit mobile: keyboard lamp, hatch, long name, download and no overflow', async () => {
    const safari = await webkit.launch(); browsers.push(safari);
    const f = await fixture(safari);
    await f.page.focus('#lamp'); await f.page.keyboard.press('ArrowDown'); assert.equal(await f.page.getAttribute('#lamp', 'aria-valuenow'), '-55');
    await hatch(f, 'W'.repeat(30)); await f.page.click('#save');
    for (const width of [320, 390]) { await f.page.setViewportSize({ width, height: 844 }); assert.equal((await layout(f.page)).scroll, width); }
    const json = JSON.parse(await download(f.page, '#dl-json')); assert.equal(json.name, 'W'.repeat(30));
    assert.equal(f.errors.length, 0, f.errors.join('\n')); await f.context.close(); return 'Passed on built export';
  });
} finally {
  for (const browser of browsers) await browser.close();
  await new Promise(resolve => server.close(resolve)); chain?.stop();
  await fs.writeFile(path.join(shots, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
process.exitCode = results.some(result => !result.passed) ? 1 : 0;
