import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-time maintenance endpoint: assigns an order number to any existing
// order that doesn't have one yet (orders placed before the order-number
// feature existed). Safe to run more than once — it only ever touches
// orders where orderNumber is still missing, in the order they were
// originally created, continuing on from whatever the highest existing
// order number already is.
export async function GET() {
  try {
    const lastNumbered = await prisma.order.findFirst({
      where: { orderNumber: { not: null } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    let nextNumber = (lastNumbered?.orderNumber ?? 99) + 1;

    // MongoDB (and Prisma's MongoDB query engine) treats "field is null"
    // and "field doesn't exist in the document at all" as two different
    // things. Orders placed before this feature existed never got the
    // orderNumber key written at all, so `orderNumber: null` alone misses
    // them — `isSet: false` catches the missing-field case too.
    const missing = await prisma.order.findMany({
      where: {
        OR: [{ orderNumber: null }, { orderNumber: { isSet: false } }],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

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
