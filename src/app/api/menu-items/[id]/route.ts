import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, image, category, available } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (image !== undefined) data.image = image;
    if (category !== undefined) data.category = category;
    if (available !== undefined) data.available = available;

    const updated = await prisma.menuItems.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, price, image, category, available } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (image !== undefined) data.image = image;
    if (category !== undefined) data.category = category;
    if (available !== undefined) data.available = available;

    const updated = await prisma.menuItems.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Items that have ever been ordered are still referenced by past
    // OrderItem records. Deleting them anyway would either fail (Prisma
    // enforces the required relation) or silently break past orders'
    // display (missing product name/price). Either way, tell the caller
    // clearly so the UI can offer "hide instead" (set available: false),
    // which removes it from ordering without touching order history.
    const orderItemCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      return NextResponse.json(
        {
          error: "HAS_ORDER_HISTORY",
          message:
            "This item is part of past orders, so it can't be deleted. Hide it instead so it stops showing up on the ordering screens.",
        },
        { status: 409 }
      );
    }

    await prisma.menuItems.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    return NextResponse.json(
      { error: "Failed to delete menu item" },
      { status: 500 }
    );
  }
}
