'use strict';
// Builds dist/artifact.html: the whole storefront as one self-contained page for hosts that cannot run a server.
// Differences from the real build: GSAP and fonts load from CDNs, and the shop runs in demo mode (in-memory orders).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pub = (f) => fs.readFileSync(path.join(root, 'public', f), 'utf8');
const gsapVersion = require('gsap/package.json').version;

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'server', 'catalog.json'), 'utf8'));
const { FREE_SHIPPING_OVER, SHIPPING } = require('../server/pricing');
const demoCatalog = { currency: 'INR', shipping: { flatPaise: SHIPPING, freeOverPaise: FREE_SHIPPING_OVER }, etaText: '2 to 4 days', products: catalog };

let html = pub('index.html');
const title = html.match(/<title>[^<]*<\/title>/)[0];
const description = html.match(/<meta name="description"[^>]*>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src="vendor/gsap.min.js"'));

const css = ['story.css', 'shop.css'].map((f) => pub('css/' + f)).join('\n');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Lilita+One&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">';
const cdn = `https://cdnjs.cloudflare.com/ajax/libs/gsap/${gsapVersion}`;
const scripts = ['rig.js', 'api.js', 'story.js', 'delivery.js', 'shop.js'].map((f) => pub('js/' + f)).join('\n;\n');

const out = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
${description}
${fonts}
<style>
${css}
</style>
${body}
<script src="${cdn}/gsap.min.js"></script>
<script src="${cdn}/ScrollTrigger.min.js"></script>
<script>
window.__RUPAL_DEMO__ = true;
window.__RUPAL_CATALOG__ = ${JSON.stringify(demoCatalog)};
</script>
<script>
${scripts}
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), out);
console.log('dist/artifact.html', (out.length / 1024).toFixed(1) + ' KB, gsap ' + gsapVersion);
