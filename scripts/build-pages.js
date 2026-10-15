'use strict';
// Builds dist/pages: the real front end (self-hosted GSAP and fonts) in demo mode, for static hosting such as GitHub Pages.
// All URLs in the page are relative, so it works under a project subpath like /rupal-s-coffee/.
const fs = require('node:fs');
const path = require('node:path');
const { FREE_SHIPPING_OVER, SHIPPING } = require('../server/pricing');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist', 'pages');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'server', 'catalog.json'), 'utf8'));
const demo = { currency: 'INR', shipping: { flatPaise: SHIPPING, freeOverPaise: FREE_SHIPPING_OVER }, etaText: '2 to 4 days', products: catalog };
const flag = `<script>window.__RUPAL_DEMO__=true;window.__RUPAL_CATALOG__=${JSON.stringify(demo)};</script>\n`;

const file = path.join(out, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const marker = '<script src="vendor/gsap.min.js" defer></script>';
if (!html.includes(marker)) throw new Error('build-pages: could not find the GSAP script tag in index.html');
fs.writeFileSync(file, html.replace(marker, flag + marker));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('dist/pages ready (demo mode, no server needed)');
