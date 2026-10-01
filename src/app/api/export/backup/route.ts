import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

// Dedicated export/backup endpoint — separate from /api/menu-items/get-all-items
// and /api/orders/get on purpose:
// - /api/orders/get caps at the 150 most recent orders (it's polled every 5
//   seconds for the live dashboard, so it stays fast). A backup needs the
//   FULL order history, so this route has no such cap.
// - Bundling both menu items and all orders into one response means the
//   "Download Backup" button on the Users Management page only needs one
//   request instead of two.
export async function GET(request: Request) {
  try {
    const site = getSiteFromRequest(request);

    const menuItems = await prisma.menuItems.findMany({
      where: siteWhere(site),
      orderBy: { createdAt: "desc" },
    });

    const orders = await prisma.order.findMany({
      where: siteWhere(site),
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      site,
      menuItems,
      orders,
    });
  } catch (error) {
    console.error("Error building backup export:", error);
    return NextResponse.json(
      { error: "Failed to build backup export" },
      { status: 500 }
    );
  }
}
