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
    const { orderId, method, undo } = await request.json().catch(() => ({}));
    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }
    if (!undo && method !== "CASH" && method !== "CARD") {
      return NextResponse.json({ error: "Choose Cash or Card." }, { status: 400 });
    }
    const site = getSiteFromRequest(request);
    const order = await prisma.order.findFirst({ where: { AND: [{ id: orderId }, siteWhere(site)] }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: undo
        ? { paymentStatus: "UNPAID", paidAt: null, paidBy: null }
        : {
            paymentStatus: "PAID",
            paymentType: method,
            paidAt: new Date(),
            paidBy: auth.user.username || auth.user.name || "staff",
          },
      select: { id: true, paymentStatus: true, paymentType: true, paidAt: true, paidBy: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error marking order paid:", err);
    return NextResponse.json({ error: "Couldn't save the payment. Try again." }, { status: 500 });
  }
}
