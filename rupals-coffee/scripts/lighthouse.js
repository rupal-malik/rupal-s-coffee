'use strict';
// Runs Lighthouse (mobile and desktop, 3 runs each) against a local instance and writes docs/lighthouse.json.
// Lab numbers only: they come from a headless Chromium on this machine, not from real users.
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/app');
const { openDb } = require('../server/db');
const { createPayments } = require('../server/payments');

const RUNS = Number(process.env.RUNS) || 3;
const PORT = 4174;
const chromePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

(async () => {
  const lighthouse = (await import('lighthouse')).default;
  const desktopConfig = (await import('lighthouse/core/config/desktop-config.js')).default;
  const chromeLauncher = await import('chrome-launcher');

  const db = openDb(':memory:');
  const server = createApp({ db, payments: createPayments() }).listen(PORT);
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
  const out = { measuredAt: new Date().toISOString(), runs: RUNS, lighthouse: null, results: {} };

  for (const form of ['mobile', 'desktop']) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(`http://localhost:${PORT}/`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, form === 'desktop' ? desktopConfig : undefined);
      out.lighthouse = r.lhr.lighthouseVersion;
      const a = r.lhr.audits, c = r.lhr.categories;
      const nv = (id) => { const v = a[id].numericValue; if (typeof v !== 'number') throw new Error(`${form} run ${i + 1}: ${id} has no value (${a[id].errorMessage || a[id].scoreDisplayMode}); runtimeError=${JSON.stringify(r.lhr.runtimeError)}`); return v; };
      runs.push({
        performance: Math.round(c.performance.score * 100), accessibility: Math.round(c.accessibility.score * 100),
        bestPractices: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
        fcpMs: Math.round(nv('first-contentful-paint')), lcpMs: Math.round(nv('largest-contentful-paint')),
        tbtMs: Math.round(nv('total-blocking-time')), cls: +nv('cumulative-layout-shift').toFixed(3),
        speedIndexMs: Math.round(nv('speed-index')), transferKb: Math.round(nv('total-byte-weight') / 1024),
      });
    }
    const keys = Object.keys(runs[0]);
    out.results[form] = Object.fromEntries(keys.map((k) => [k, k === 'cls' ? +median(runs.map((r) => r[k])).toFixed(3) : median(runs.map((r) => r[k]))]));
    out.results[form].allRuns = runs;
  }
  await chrome.kill(); server.close(); db.close();
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'lighthouse.json'), JSON.stringify(out, null, 2));
  for (const f of ['mobile', 'desktop']) { const { allRuns, ...m } = out.results[f]; console.log(f, JSON.stringify(m)); }
})().catch((e) => { console.error(e); process.exit(1); });
