# Rupal's Coffee (Project)

A scroll-driven cartoon storefront. Scrolling brews a cup of coffee on screen. **Buy now** opens a shop sheet backed by a small orders API, and placing an order plays a scooter delivery scene.

```bash
npm install
npm start            # http://localhost:3000
npm test             # API tests (node:test)
npm run test:visual  # Playwright screenshot tests, desktop + mobile
npm run lighthouse   # Lighthouse, 3 runs each for mobile and desktop
npm run build:artifact  # single-file demo build in dist/
npm run build:pages     # static demo site in dist/pages (used by the Pages deploy)
```

Requires Node 22.5 or newer (the database is Node's built-in `node:sqlite`, which is still marked experimental).

## Architecture

```
Browser (static files in public/)                 Server (Express 5, server/)
┌──────────────────────────────┐   fetch /api    ┌────────────────────────────────────────────┐
│ story.js   GSAP timeline,    │ ──────────────▶ │ helmet (CSP) → compression → rate limit    │
│            scrubbed by scroll│                 │ zod validation   (validate.js)             │
│ shop.js    cart + checkout   │                 │ order service    (orders.js)               │
│ api.js     fetch + demo mode │ ◀────────────── │   ├─ pricing     (pricing.js, catalog.json)│
│ delivery.js scooter timeline │   JSON          │   ├─ payments    (payments.js: cod, mock)  │
└──────────────────────────────┘                 │   └─ SQLite      (db.js)                   │
                                                 └────────────────────────────────────────────┘
```

**Animation.** GSAP 3 + ScrollTrigger. One ~16 second timeline holds the whole brew; ScrollTrigger maps scroll position to its playhead, so scrolling back rewinds it. The art is inline SVG with no image files. Ambient loops (drips, steam, wheels) are CSS keyframes. Pivoted rotations use a tiny `rig()` helper that writes one SVG transform, because GSAP's `svgOrigin` gave wrong pivots inside nested groups.

**Checkout.** The client sends SKUs and quantities only. The server prices the order from `catalog.json`, so a tampered price in the request is rejected (unknown fields fail validation). Money is integer paise.

**Reliability and safety.**
- `Idempotency-Key` header: a double click or network retry returns the original order instead of creating a second one (unique index plus race handling).
- Rate limit on `POST /api/orders`, 10 KB body limit, strict CSP with no inline scripts.
- The public order lookup never returns address or phone.
- A payment failure returns `402` and stores no order.

**Payments.** Providers share one interface, `authorize({ amount, orderId })`. Two exist: cash on delivery, and a mock "online (test mode)" provider that charges nothing. Adding Stripe or Razorpay means adding one class in `payments.js` (plus a webhook route); the order service does not change.

### API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/products` | Catalog, shipping rule, delivery estimate |
| POST | `/api/orders` | `items[]`, `customer`, `paymentMethod`; optional `Idempotency-Key`. `201` new, `200` replay, `402` payment failed, `422` invalid |
| GET | `/api/orders/:id` | Public view of an order |
| GET | `/api/health` | Liveness |

## Tests

- `tests/api.test.js`: 9 tests covering server-side pricing, validation, idempotency, privacy of the lookup, payment failure, and rate limiting.
- `tests/visual.spec.js`: 18 Playwright screenshot checks across desktop (1280x800) and mobile (390x844): 7 points of the brew, the shop sheet, and 3 frames of the delivery scene, including a real order through the UI and a check that the order exists on the server. The scrubbed timeline is waited on until it reaches the target time, and CSS animation is frozen, so the runs are stable. A deliberate colour change made 14 of the 18 fail, so the suite does catch regressions.
- Baselines are Linux Chromium renders (`tests/visual.spec.js-snapshots/`). Regenerate them with `npm run test:visual:update` when the look changes on purpose, and generate them in the same environment your CI uses.

## Performance

Lighthouse 13.5.0, headless Chromium, local server, median of 3 runs (`docs/lighthouse.json`). These are lab numbers for the first page load, not field data.

| | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile (Lighthouse default throttling) | 99 | 100 | 100 | 100 | 1.44 s | 2.01 s | 40 ms | 0 | 165 KB |
| Desktop | 100 | 100 | 100 | 100 | 0.37 s | 0.51 s | 0 ms | 0 | 165 KB |

LCP, TBT (the lab stand-in for INP) and CLS are all inside the "good" thresholds. INP itself needs real user interaction, so it is not measured here. The weight comes from self-hosted fonts, GSAP, and one inline SVG scene. Fonts and vendor files are served with one-year immutable caching.

## Demo build

`npm run build:artifact` produces one HTML file with the CSS and JS inlined, GSAP and fonts loaded from CDNs, and the shop in **demo mode**: orders are created in memory and nothing is saved. A host that cannot run a server can show everything except the real API.

## CI and deploy

`.github/workflows/ci-deploy.yml` has three jobs:

- **test** runs the API tests on every push and pull request.
- **visual** runs the Playwright screenshot tests. It does not block the deploy. Baselines come from one Chromium build, so the first run on GitHub may show small rendering differences. If it does, run the workflow manually with "Regenerate the visual baselines" ticked, download the `visual-baselines` artifact, and commit it.
- **deploy** (pushes to `main` only, after `test` passes) runs `npm run build:pages` and publishes `dist/pages` to GitHub Pages. That is the demo-mode site, so orders there are not saved. One-time setup: Settings > Pages > Source = "GitHub Actions".

The real API needs a host that runs Node (Render, Fly.io, Railway or a VPS); GitHub Pages cannot run it.

## What this is not

- No real payment gateway. Cash on delivery and a mock provider only.
- No accounts, admin screen, inventory, emails, or SMS. Orders are stored in SQLite and can be read from the database file.
- Products, prices, and the delivery estimate are sample data in `server/catalog.json` and `ETA_TEXT`.
- The delivery scene is a playful preview, not live tracking.
- `node:sqlite` is experimental; swap `db.js` for `better-sqlite3` or Postgres if you need a stable driver. The rest of the code only talks to the small interface in `db.js`.

## Layout

```
server/   app.js  index.js  orders.js  pricing.js  payments.js  validate.js  db.js  catalog.json
public/   index.html  css/  js/  vendor/ (GSAP)  fonts/ (self-hosted)
tests/    api.test.js  visual.spec.js  visual.spec.js-snapshots/
scripts/  lighthouse.js  build-artifact.js
docs/     lighthouse.json  LINKEDIN_POST.md
```
