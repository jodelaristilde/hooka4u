import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

// One-time maintenance endpoint: assigns an order number to any existing
// order that doesn't have one yet (orders placed before the order-number
// feature existed). Safe to run more than once — it only ever touches
// orders where orderNumber is still missing, in the order they were
// originally created, continuing on from whatever the highest existing
// order number already is.
//
// This is a bulk operation, so it's scoped to the current site only
// (determined by the Host header the request came in on) — running it on
// vipservice4u.us must never touch or renumber Jaeky's orders, and vice
// versa.
export async function GET(request: NextRequest) {
  try {
    const site = getSiteFromRequest(request);

    const lastNumbered = await prisma.order.findFirst({
      where: { orderNumber: { not: null }, ...siteWhere(site) },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    let nextNumber = (lastNumbered?.orderNumber ?? 99) + 1;

    // Filtering for "missing orderNumber" directly in the MongoDB query
    // (orderNumber: null, or isSet: false) wasn't reliably catching every
    // case here. To be completely certain, fetch every order for this
    // site and filter in plain JavaScript instead — immune to any
    // query-translation quirks between null, missing, 0, etc.
    const siteOrders = await prisma.order.findMany({
      where: siteWhere(site),
      orderBy: { createdAt: "asc" },
      select: { id: true, orderNumber: true },
    });
    const missing = siteOrders.filter((order) => !order.orderNumber);

    for (const order of missing) {
      await prisma.order.update({
        where: { id: order.id },
        data: { orderNumber: nextNumber },
      });
      nextNumber++;
    }

    return NextResponse.json({
      updated: missing.length,
      message: `Assigned order numbers to ${missing.length} order(s) that were missing one.`,
    });
  } catch (error) {
    console.error("Error backfilling order numbers:", error);
    return NextResponse.json(
      { error: "Failed to backfill order numbers" },
      { status: 500 }
    );
  }
}
