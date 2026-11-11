import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { canTakePayment, requireUser } from "@/lib/api-auth";

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
    // "Pay before the order shows": when the admin turns this on, regular
    // staff only get orders that are paid. Cashiers and admins see all.
    const handlesMoney = canTakePayment(auth);
    let hideUnpaid = false;
    if (!handlesMoney) {
      const setting = await prisma.siteSetting.findFirst({ where: { site } }).catch(() => null);
      hideUnpaid = Boolean(setting?.requirePayment);
    }

    const orders = await prisma.order.findMany({
      where: hideUnpaid
        ? {
            AND: [
              siteWhere(site),
              // Paid, or an older order from before payments were tracked
              // (no value saved). Same unset-field handling as siteWhere.
              {
                OR: [
                  { paymentStatus: "PAID" },
                  { paymentStatus: null },
                  { paymentStatus: { isSet: false } },
                ],
              },
            ],
          }
        : siteWhere(site),
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

    // Staff never see prices: for anyone who isn't an admin or cashier,
    // the order total and item prices are left out of what's sent to their
    // device. Admins and cashiers get them (to collect money / see sales).
    const showPrices = handlesMoney;
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
