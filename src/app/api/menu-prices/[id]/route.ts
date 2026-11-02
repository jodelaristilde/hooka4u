// app/api/menu-prices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "@/lib/api-auth";

const prisma = new PrismaClient();

// GET single menu item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    
    const menuItem = await prisma.menuItems.findUnique({
      where: {
        id: id,
      },
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(menuItem);
  } catch (error) {
    console.error("Error fetching menu item:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu item" },
      { status: 500 }
    );
  }
}

// PUT update menu item (price and availability)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();
    const { price, available } = body;

    // Validate price
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "Price is required and must be more than $0.00." },
        { status: 400 }
      );
    }

    // Validate available
    if (typeof available !== "boolean") {
      return NextResponse.json(
        { error: "Invalid availability. Available must be a boolean value." },
        { status: 400 }
      );
    }

    // Check if menu item exists
    const existingItem = await prisma.menuItems.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    // Update price and availability
    const updatedMenuItem = await prisma.menuItems.update({
      where: {
        id: id,
      },
      data: {
        price: price,
        available: available,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedMenuItem);
  } catch (error) {
    console.error("Error updating menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
      { status: 500 }
    );
  }
}