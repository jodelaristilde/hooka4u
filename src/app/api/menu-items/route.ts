import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const allItems = await prisma.menuItems.findMany({
      orderBy: { createdAt: 'desc' }
    });

    let menuItems = allItems.filter(item => item.available === true);

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
    const body = await request.json();
    const { name, description, price, image, category } = body;

    const menuItem = await prisma.menuItems.create({
      data: {
        name,
        description,
        image: image || null,
        price: 0,
        category: category || null,
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
