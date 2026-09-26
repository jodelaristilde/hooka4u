import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Public endpoint: guests look up their order status by the short order number.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumberParam = searchParams.get("orderNumber");

    if (!orderNumberParam) {
      return NextResponse.json(
        { error: "Order number is required" },
        { status: 400 }
      );
    }

    const orderNumber = parseInt(orderNumberParam, 10);
    if (isNaN(orderNumber)) {
      return NextResponse.json(
        { error: "Invalid order number" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber },
      orderBy: { createdAt: "desc" },
      select: {
        orderNumber: true,
        status: true,
        customerName: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error looking up order status:", error);
    return NextResponse.json(
      { error: "Failed to look up order status" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required" },
        { status: 400 }
      );
    }

    if (!["PENDING", "DELIVERED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING or DELIVERED" },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
