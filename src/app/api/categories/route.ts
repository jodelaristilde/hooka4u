import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

// Returns every category record, including hidden ones, for the current
// site only (determined by the request's Host header). Used by:
// - the admin Menu page (to manage/hide/show categories)
// - the ordering screens (they filter out hidden ones themselves)
export async function GET(request: Request) {
  try {
    const site = getSiteFromRequest(request);

    const categories = await prisma.menuCategory.findMany({
      where: siteWhere(site),
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
    const site = getSiteFromRequest(request);
    const body = await request.json();
    const rawName = typeof body.name === "string" ? body.name.trim() : "";

    if (!rawName) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const name = rawName.toUpperCase();

    // Uniqueness is now (name, site) — but legacy vipservice4u categories
    // may not have a `site` field set yet, so use findFirst with the
    // null-fallback filter instead of a strict findUnique on the compound
    // key (which wouldn't match those legacy documents).
    const existing = await prisma.menuCategory.findFirst({
      where: { name, ...siteWhere(site) },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A category with that name already exists" },
        { status: 409 }
      );
    }

    const count = await prisma.menuCategory.count({ where: siteWhere(site) });

    const category = await prisma.menuCategory.create({
      data: {
        name,
        hidden: false,
        order: count,
        site,
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
