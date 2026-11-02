import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { isAdminSession, requireUser } from "@/lib/api-auth";

// The dashboard polls this every 5 seconds expecting fresh data every
// time (to catch brand-new orders and trigger the alert sound). Force
// this route to always run live instead of letting Next.js/Vercel cache
// a response and serve it again on the next poll.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const site = getSiteFromRequest(request);

    // Fetch recent orders from database, scoped to the current site.
    // - `select` on product intentionally leaves out `image`: product
    //   images are large base64 strings, and the same handful of product
    //   images would otherwise be re-sent once per item on every order,
    //   every single 5-second refresh. The dashboard instead fetches the
    //   product catalog's images once (see /api/menu-items/get-all-items)
    //   and looks them up by product id on the client.
    // - `take` caps this to the most recent orders so the dashboard stays
    //   fast as order history grows, instead of re-downloading the entire
    //   order history every 5 seconds.
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
      orderBy: {
        createdAt: "desc",
      },
      take: 150,
    });

    // Staff never see prices: for anyone who isn't an admin, the order
    // total and item prices are left out of what's sent to their device
    // (the All Orders screen doesn't show them either). Admins still get
    // them, for the Today's Sales panel.
    const showPrices = isAdminSession(auth);
    const ordersWithDefaults = orders.map((order) => {
      const base = { ...order, paymentType: order.paymentType || "CASH" };
      if (showPrices) return base;
      return {
        ...base,
        subtotal: 0,
        items: order.items.map((item) => ({
          ...item,
          product: item.product ? { id: item.product.id, name: item.product.name, price: 0 } : null,
        })),
      };
    });

    return NextResponse.json(ordersWithDefaults);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: `Failed to fetch orders ${error}` },
      { status: 500 }
    );
  }
}
