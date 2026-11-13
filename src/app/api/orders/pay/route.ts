import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { canTakePayment, requireUser } from "@/lib/api-auth";

// Cashier/admin marks an order Paid (cash or card), or undoes it.
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canTakePayment(auth)) {
    return NextResponse.json({ error: "Only a cashier or admin can take payment." }, { status: 403 });
  }
  try {
    const { orderId, method, undo, cashReceived } = await request.json().catch(() => ({}));
    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }
    if (!undo && method !== "CASH" && method !== "CARD") {
      return NextResponse.json({ error: "Choose Cash or Card." }, { status: 400 });
    }
    const site = getSiteFromRequest(request);
    const order = await prisma.order.findFirst({
      where: { AND: [{ id: orderId }, siteWhere(site)] },
      select: { id: true, subtotal: true, paymentLog: true, paymentType: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const who = auth.user.username || auth.user.name || "staff";
    const now = new Date();
    const received =
      !undo && method === "CASH" && typeof cashReceived === "number" && isFinite(cashReceived) && cashReceived >= 0
        ? Math.round(cashReceived * 100) / 100
        : null;
    // Keep a running record of every Paid / Undo on this order.
    const log = Array.isArray(order.paymentLog) ? [...(order.paymentLog as unknown[])] : [];
    log.push(
      undo
        ? { action: "UNDO", by: who, at: now.toISOString(), method: order.paymentType ?? null, amount: order.subtotal }
        : { action: "PAID", by: who, at: now.toISOString(), method, amount: order.subtotal, cashReceived: received }
    );

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: undo
        ? { paymentStatus: "UNPAID", paidAt: null, paidBy: null, cashReceived: null, paymentLog: log }
        : {
            paymentStatus: "PAID",
            paymentType: method,
            paidAt: now,
            paidBy: who,
            cashReceived: received,
            paymentLog: log,
          },
      select: { id: true, paymentStatus: true, paymentType: true, paidAt: true, paidBy: true, cashReceived: true, paymentLog: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error marking order paid:", err);
    return NextResponse.json({ error: "Couldn't save the payment. Try again." }, { status: 500 });
  }
}
