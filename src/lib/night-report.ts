// src/lib/night-report.ts
//
// End-of-night sales report: totals, cash vs card, top items, and every
// order. Used by the admin "Today's sales" panel on All Orders and by the
// wash-up dialog, so the night's numbers can be saved before wash-up
// clears the orders.

export interface ReportOrder {
  orderNumber?: number | null;
  customerName: string;
  subtotal: number;
  createdAt: string;
  paymentType?: string | null;
  Seating?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  paidBy?: string | null;
  cashReceived?: number | null;
  cardTotal?: number | null;
  paymentLog?: unknown;
  items: { quantity: number; product: { id: string; name: string; price: number } | null }[];
}

export interface NightReport {
  date: Date;
  total: number;
  /** Extra the customers paid by paying with card (dual pricing). */
  cardFees: number;
  count: number;
  items: number;
  cash: number;
  card: number;
  ready: number;
  pending: number;
  /** Ordered but not paid yet (cashier flow). Cash/Card only count paid. */
  unpaid: number;
  /** Money each person took tonight (for counting the drawer). */
  byPerson: { name: string; cash: number; card: number; orders: number }[];
  /** Payments that were marked Paid and then undone (who undid them). */
  undone: { orderNumber?: number | null; by: string; amount: number }[];
  topItems: { name: string; quantity: number; sales: number }[];
  orders: ReportOrder[];
}

/** Clubs run past midnight, so a "night" runs 6 AM to 6 AM: at 1 AM,
 * tonight still means since 6 AM yesterday. (This device's clock.) */
export const NIGHT_STARTS_AT_HOUR = 6;

export function startOfTonight(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(NIGHT_STARTS_AT_HOUR, 0, 0, 0);
  if (now < d) d.setDate(d.getDate() - 1);
  return d;
}

/** Orders placed tonight (since 6 AM; see above). */
export function todaysOrders<T extends { createdAt: string }>(orders: T[]): T[] {
  const start = startOfTonight();
  return orders.filter((o) => new Date(o.createdAt) >= start);
}

// What an order actually brings in: card payments are charged the card
// price (dual pricing); everything else the cash price.
function amount(o: ReportOrder): number {
  return o.paymentStatus !== "UNPAID" && o.paymentType === "CARD" && typeof o.cardTotal === "number"
    ? o.cardTotal
    : o.subtotal || 0;
}

export function buildNightReport(orders: ReportOrder[], date: Date = startOfTonight()): NightReport {
  const sum = (list: ReportOrder[]) => list.reduce((s, o) => s + amount(o), 0);
  const byItem = new Map<string, { name: string; quantity: number; sales: number }>();
  let items = 0;
  for (const o of orders) {
    for (const it of o.items) {
      items += it.quantity;
      const name = it.product?.name ?? "Item no longer available";
      const key = it.product?.id ?? name;
      const row = byItem.get(key) ?? { name, quantity: 0, sales: 0 };
      row.quantity += it.quantity;
      row.sales += (it.product?.price ?? 0) * it.quantity;
      byItem.set(key, row);
    }
  }
  return {
    date,
    total: sum(orders),
    cardFees: orders.reduce((s, o) => s + (amount(o) - (o.subtotal || 0)), 0),
    count: orders.length,
    items,
    cash: sum(orders.filter((o) => o.paymentStatus !== "UNPAID" && o.paymentType !== "CARD")),
    card: sum(orders.filter((o) => o.paymentStatus !== "UNPAID" && o.paymentType === "CARD")),
    unpaid: sum(orders.filter((o) => o.paymentStatus === "UNPAID")),
    byPerson: (() => {
      const m = new Map<string, { name: string; cash: number; card: number; orders: number }>();
      for (const o of orders) {
        if (o.paymentStatus !== "PAID") continue;
        const name = o.paidBy || "Unknown";
        const row = m.get(name) ?? { name, cash: 0, card: 0, orders: 0 };
        if (o.paymentType === "CARD") row.card += amount(o);
        else row.cash += amount(o);
        row.orders += 1;
        m.set(name, row);
      }
      return [...m.values()].sort((a, b) => b.cash + b.card - (a.cash + a.card));
    })(),
    undone: orders.flatMap((o) =>
      (Array.isArray(o.paymentLog) ? (o.paymentLog as { action?: string; by?: string; amount?: number }[]) : [])
        .filter((e) => e?.action === "UNDO")
        .map((e) => ({ orderNumber: o.orderNumber, by: e.by || "Unknown", amount: e.amount ?? o.subtotal ?? 0 }))
    ),
    ready: sum(orders.filter((o) => o.status === "DELIVERED")),
    pending: sum(orders.filter((o) => o.status !== "DELIVERED")),
    topItems: [...byItem.values()].sort((a, b) => b.quantity - a.quantity || b.sales - a.sales),
    orders: [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

const money = (n: number) => n.toFixed(2);
const cell = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A spreadsheet-friendly (CSV) version of the report. */
export function nightReportCsv(r: NightReport, siteName: string): string {
  const day = r.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const rows: (string | number)[][] = [
    [`${siteName} - Night report`],
    [day],
    [],
    ["Total sales", money(r.total)],
    ["Orders", r.count],
    ["Items", r.items],
    ["Cash", money(r.cash)],
    ["Card", money(r.card)],
    ["Not paid yet", money(r.unpaid)],
    ["Card price extra (paid by customers)", money(r.cardFees)],
    ["Ready (served)", money(r.ready)],
    ["Still pending", money(r.pending)],
    [],
    ["Taken by", "Cash", "Card", "Total", "Orders"],
    ...r.byPerson.map((p) => [p.name, money(p.cash), money(p.card), money(p.cash + p.card), p.orders]),
    ...(r.undone.length
      ? [[], ["Payments undone", "Order #", "Amount"], ...r.undone.map((u) => [u.by, u.orderNumber ?? "", money(u.amount)])]
      : []),
    [],
    ["Top items", "Quantity", "Sales"],
    ...r.topItems.map((t) => [t.name, t.quantity, money(t.sales)]),
    [],
    ["Order #", "Time", "Customer", "Seat", "Payment", "Paid", "Taken by", "Status", "Items", "Total"],
    ...r.orders.map((o) => [
      o.orderNumber ?? "",
      new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      o.customerName || "Guest",
      o.Seating ?? "",
      o.paymentType === "CARD" ? "Card" : "Cash",
      o.paymentStatus === "UNPAID" ? "No" : "Yes",
      o.paidBy ?? "",
      o.status === "DELIVERED" ? "Ready" : "Pending",
      o.items.map((i) => `${i.quantity}x ${i.product?.name ?? "Item"}`).join("; "),
      money(amount(o)),
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function downloadNightReport(r: NightReport, siteName: string) {
  const csv = nightReportCsv(r, siteName);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = r.date.toISOString().slice(0, 10);
  a.href = url;
  a.download = `${siteName.replace(/\s+/g, "-").toLowerCase()}-night-report-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
