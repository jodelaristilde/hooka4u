// src/lib/print-ticket.ts
//
// Prints a small "READY" ticket for one order (no prices) so staff can
// attach it to the order. Uses the page's own print (window.print) with a
// print-only block, so it works on iPad/iPhone AirPrint, Android and
// desktop printers without pop-ups. The ticket is centered across the
// paper, so it lines up on a receipt printer or a full-size printer.
//
// Fully automatic printing (no print sheet) is only possible on a computer
// running Chrome with the --kiosk-printing flag, which sends straight to the
// default printer. Phones and iPads always show the print sheet first.

export interface TicketOrder {
  orderNumber?: number | null;
  customerName?: string | null;
  Seating?: string | null;
  paymentType?: string | null;
  createdAt: string;
  items: { quantity: number; product?: { name?: string | null } | null }[];
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function printOrderTicket(order: TicketOrder, brandName: string) {
  if (typeof window === "undefined") return;

  document.getElementById("order-ticket-print")?.remove();
  document.getElementById("order-ticket-print-style")?.remove();

  const style = document.createElement("style");
  style.id = "order-ticket-print-style";
  style.textContent = `
    #order-ticket-print { display: none; }
    @media print {
      @page { margin: 4mm; }
      html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
      body > *:not(#order-ticket-print) { display: none !important; }
      #order-ticket-print {
        display: block !important; width: 72mm; max-width: 100%; margin: 0 auto;
        font-family: -apple-system, Helvetica, Arial, sans-serif; color: #000; background: #fff;
      }
      #order-ticket-print .t-brand { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; text-align: center; }
      #order-ticket-print .t-ready { font-size: 26px; font-weight: 900; text-align: center; border: 3px solid #000; margin: 6px 0; padding: 4px 0; letter-spacing: 4px; }
      #order-ticket-print .t-no { font-size: 40px; font-weight: 900; text-align: center; line-height: 1; }
      #order-ticket-print .t-name { font-size: 22px; font-weight: 800; text-align: center; margin: 4px 0 8px; }
      #order-ticket-print .t-row { font-size: 15px; margin: 2px 0; }
      #order-ticket-print ul { list-style: none; padding: 0; margin: 8px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000; }
      #order-ticket-print li { font-size: 17px; font-weight: 700; padding: 4px 0; }
      #order-ticket-print .t-time { font-size: 11px; text-align: center; }
    }`;

  const placed = new Date(order.createdAt);
  const el = document.createElement("div");
  el.id = "order-ticket-print";
  el.innerHTML = `
    <div class="t-brand">${esc(brandName)}</div>
    <div class="t-ready">READY</div>
    <div class="t-no">#${esc(order.orderNumber ?? "")}</div>
    <div class="t-name">${esc(order.customerName || "Guest")}</div>
    <div class="t-row"><b>Location:</b> ${esc(order.Seating || "—")}</div>
    <div class="t-row"><b>Paying:</b> ${order.paymentType === "CARD" ? "with Credit card" : "Cash"}</div>
    <ul>${order.items
      .map((i) => `<li>${esc(i.quantity)} × ${esc(i.product?.name ?? "Item")}</li>`)
      .join("")}</ul>
    <div class="t-time">Ordered ${esc(placed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))} · Printed ${esc(
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    )}</div>`;

  document.head.appendChild(style);
  document.body.appendChild(el);

  const cleanup = () => {
    el.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Small delay so the ticket is in the page before the print sheet opens.
  setTimeout(() => window.print(), 50);
}
