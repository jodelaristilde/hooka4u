import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch recent orders from database.
    // - `select` on product avoids pulling unused fields (description,
    //   category, timestamps) for every single item on every order.
    // - `take` caps this to the most recent orders so the dashboard stays
    //   fast as order history grows, instead of re-downloading the entire
    //   order history (including every product's image) every 5 seconds.
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                image: true,
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
