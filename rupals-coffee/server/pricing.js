'use strict';
// All money is integer paise (1/100 rupee). Prices always come from the catalog, never from the client.
const FREE_SHIPPING_OVER = 99900;
const SHIPPING = 4900;
const MAX_QTY = 20;

class UnknownSkuError extends Error {
  constructor(sku) { super(`Unknown product: ${sku}`); this.name = 'UnknownSkuError'; this.sku = sku; }
}

function priceOrder(items, catalog) {
  const bySku = new Map(catalog.map((p) => [p.sku, p]));
  const merged = new Map();
  for (const { sku, qty } of items) merged.set(sku, (merged.get(sku) || 0) + qty);

  const lines = [];
  for (const [sku, qty] of merged) {
    const product = bySku.get(sku);
    if (!product) throw new UnknownSkuError(sku);
    if (qty > MAX_QTY) throw new RangeError(`Quantity for ${sku} exceeds ${MAX_QTY}`);
    lines.push({ sku, name: product.name, size: product.size, qty, unitPaise: product.pricePaise, linePaise: product.pricePaise * qty });
  }
  const subtotal = lines.reduce((n, l) => n + l.linePaise, 0);
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

module.exports = { priceOrder, UnknownSkuError, FREE_SHIPPING_OVER, SHIPPING, MAX_QTY };
