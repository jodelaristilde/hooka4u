// app/api/menu-templates/route.ts
//
// The "item library" — reusable item photos/descriptions saved separately
// from the live menu (MenuItems). Nothing here is ever touched by Washup
// or the Menu page's "Delete All Items & Categories" — that's the point:
// an admin can save a photo + name + description + category once, then
// reuse it to quickly rebuild the live menu for a new event without
// re-uploading and re-editing the same image every time.
//
// Templates are partitioned per site (vipservice4u vs jaeky), same as
// live menu items — see src/lib/site.ts.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

// Always fetch fresh — same reasoning as the menu-prices route fix: a GET
// handler with no request-specific data gets statically cached by Next.js
// otherwise, and would keep showing stale templates after edits/deletes.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const templates = await prisma.menuItemTemplate.findMany({
      where: siteWhere(site),
      orderBy: { name: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching menu templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const body = await request.json();
    const { name, description, image, category } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const template = await prisma.menuItemTemplate.create({
      data: {
        name: String(name).trim(),
        description: description || null,
        image: image || null,
        category: category || null,
        site,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating menu template:", error);
    return NextResponse.json(
      { error: "Failed to create menu template" },
      { status: 500 }
    );
  }
}
