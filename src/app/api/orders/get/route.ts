import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// The dashboard polls this every 5 seconds expecting fresh data every
// time (to catch brand-new orders and trigger the alert sound). Force
// this route to always run live instead of letting Next.js/Vercel cache
// a response and serve it again on the next poll.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Fetch recent orders from database.
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

    // Map orders and set default paymentType to CASH if null
    const ordersWithDefaults = orders.map((order) => ({
      ...order,
      paymentType: order.paymentType || "CASH",
    }));

    return NextResponse.json(ordersWithDefaults);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: `Failed to fetch orders ${error}` },
      { status: 500 }
    );
  }
}
