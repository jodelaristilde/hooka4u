import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { step } = await request.json();

    switch (step) {
      case "order-items":
        // Delete all order items first — menu items and orders both have a
        // required relation to order items, so this has to clear before
        // either of those can be deleted.
        await prisma.orderItem.deleteMany({});
        return NextResponse.json({ success: true, step: "order-items" });

      case "menu-items":
        // Delete every menu item completely (not just zero the price)
        await prisma.menuItems.deleteMany({});
        return NextResponse.json({ success: true, step: "menu-items" });

      case "menu-categories":
        // Delete every menu category completely
        await prisma.menuCategory.deleteMany({});
        return NextResponse.json({ success: true, step: "menu-categories" });

      case "orders":
        // Delete all orders
        await prisma.order.deleteMany({});
        return NextResponse.json({ success: true, step: "orders" });

      case "users":
        // Delete all users
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
