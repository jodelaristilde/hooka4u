import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

export async function GET(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const admin = searchParams.get("admin");

    const allItems = await prisma.menuItems.findMany({
      where: siteWhere(site),
      orderBy: { createdAt: 'desc' }
    });

    let menuItems = admin === "true"
      ? allItems
      : allItems.filter(item => item.available === true);

    if (category) {
      menuItems = menuItems.filter(
        (item) => item.category?.toUpperCase() === category.toUpperCase()
      );
    }

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error('Error details:', error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { name, description, price, image, category, available } = body;

    // Price is required: every item on the menu needs a real price.
    const priceValue = typeof price === "string" ? parseFloat(price) : price;
    if (typeof priceValue !== "number" || !Number.isFinite(priceValue) || priceValue <= 0) {
      return NextResponse.json(
        { error: "Price is required and must be more than $0.00" },
        { status: 400 }
      );
    }

    const menuItem = await prisma.menuItems.create({
      data: {
        name,
        description,
        image: image || null,
        price: Math.round(priceValue * 100) / 100,
        category: category || null,
        available: available ?? false,
        site,
        // Tag the item with whoever is logged in and creating it, so it
        // can later be viewed/filtered by user without needing their login.
        createdByUsername: session?.user?.username || null,
      },
    });

    return NextResponse.json(menuItem, { status: 201 });
  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}
