import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Washup is a bulk reset, so every step below is scoped to the
    // current site only (via the Host header) — running washup on
    // vipservice4u.us must never delete Jaeky's menu/orders, and vice
    // versa. The "users" step is the one exception: logins are shared
    // across both sites, so it isn't site-scoped.
    const site = getSiteFromRequest(request);

    const { step } = await request.json();

    switch (step) {
      case "order-items": {
        // Delete all order items first — menu items and orders both have
        // a required relation to order items, so this has to clear
        // before either of those can be deleted. Order items don't carry
        // their own `site` field, so scope this by finding which orders
        // and menu items belong to the current site, and deleting any
        // order item that points at either of those.
        const [siteOrders, siteMenuItems] = await Promise.all([
          prisma.order.findMany({ where: siteWhere(site), select: { id: true } }),
          prisma.menuItems.findMany({ where: siteWhere(site), select: { id: true } }),
        ]);
        const orderIds = siteOrders.map((o) => o.id);
        const productIds = siteMenuItems.map((i) => i.id);

        await prisma.orderItem.deleteMany({
          where: {
            OR: [
              { orderId: { in: orderIds } },
              { productId: { in: productIds } },
            ],
          },
        });
        return NextResponse.json({ success: true, step: "order-items" });
      }

      case "menu-items":
        // Delete every menu item completely (not just zero the price),
        // for the current site only.
        await prisma.menuItems.deleteMany({ where: siteWhere(site) });
        return NextResponse.json({ success: true, step: "menu-items" });

      case "menu-categories":
        // Delete every menu category completely, for the current site only.
        await prisma.menuCategory.deleteMany({ where: siteWhere(site) });
        return NextResponse.json({ success: true, step: "menu-categories" });

      case "orders":
        // Delete all orders for the current site only.
        await prisma.order.deleteMany({ where: siteWhere(site) });
        return NextResponse.json({ success: true, step: "orders" });

      case "users":
        // Users/logins are shared across both sites (no `site` field on
        // User), so this intentionally is NOT scoped by site.
        await prisma.user.deleteMany({
          where: { role: "USER" },
        });
        return NextResponse.json({ success: true, step: "users" });

      default:
        return NextResponse.json({ message: "Invalid step" }, { status: 400 });
    }
  } catch (error) {
    console.error("Washup error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
