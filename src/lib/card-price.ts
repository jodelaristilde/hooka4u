// src/lib/card-price.ts
//
// Dual pricing: every item has a cash price (what's saved on the menu) and
// a card price that is a set percentage higher, so the customer covers the
// card processing fee. The admin sets the percentage (0 = off).

/** Card price for one item, rounded to the cent. */
export function cardPrice(cash: number, percent: number): number {
  if (!percent || percent <= 0 || !isFinite(cash)) return cash;
  // Work in cents (and nudge past float error) so $25 at 3.5% is $25.88.
  return Math.round((cash * 100 * (100 + percent)) / 100 + 1e-6) / 100;
}

/** Card total for a list of items (each item's card price × quantity). */
export function cardTotal(
  items: { price: number; quantity: number }[],
  percent: number
): number {
  const t = items.reduce((s, i) => s + cardPrice(i.price || 0, percent) * (i.quantity || 0), 0);
  return Math.round(t * 100) / 100;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
