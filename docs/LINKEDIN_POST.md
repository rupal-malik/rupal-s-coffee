# LinkedIn post draft

I built a coffee shop site where scrolling brews the coffee.

Rupal's Coffee started as a scroll animation: a filter drops into a drip machine, the beans go in, the copper element clicks on, and the cup fills as you scroll. Then I turned it into a small shop. "Buy now" opens a checkout, and when you place an order a rider on a scooter delivers the bag to your door.

What's under it:
- GSAP + ScrollTrigger drive a single timeline, and the art is hand-built inline SVG with no image files.
- An Express API prices every order on the server, validates input with zod, and makes retries safe with idempotency keys. Payments sit behind a small provider interface (cash on delivery and a test-mode provider for now).
- 9 API tests and 18 Playwright screenshot tests across desktop and phone. When I changed one colour on purpose, 14 of them failed, which is what I wanted to see.
- Lighthouse on mobile: 99 performance, 100 accessibility, LCP 2.0 s, CLS 0. Lab numbers, not field data.

I used Claude to move faster, and I reviewed and debugged the result myself. For example, GSAP's SVG pivot option gave wrong rotations inside nested groups, so I replaced it with explicit transforms.

Still to do: a real payment gateway, an admin view, and order emails.

Live demo: [link]
Code: [link]

#frontend #javascript #gsap #nodejs #webperformance
