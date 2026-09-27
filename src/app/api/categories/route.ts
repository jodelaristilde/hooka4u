import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns every category record, including hidden ones. Used by:
// - the admin Menu page (to manage/hide/show categories)
// - the ordering screens (they filter out hidden ones themselves)
export async function GET() {
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!rawName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const name = rawName.toUpperCase();

    const existing = await prisma.menuCategory.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: "A category with that name already exists" },
        { status: 409 }
      );
    }

    const count = await prisma.menuCategory.count();

    const category = await prisma.menuCategory.create({
      data: {
        name,
        hidden: false,
        order: count,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
