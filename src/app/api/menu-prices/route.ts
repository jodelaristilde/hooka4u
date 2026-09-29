// app/api/menu-prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

const prisma = new PrismaClient();

// Always fetch fresh from the database — without this, Next.js caches this
// route's response at build time since it doesn't read anything from the
// request. That stale cache is what let Menu Prices keep showing items
// after they were deleted elsewhere (like the "wash up" reset).
export const dynamic = "force-dynamic";

// GET all menu items for the current site (determined by the Host header)
export async function GET(request: NextRequest) {
  try {
    const site = getSiteFromRequest(request);

    const menuItems = await prisma.menuItems.findMany({
      where: siteWhere(site),
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(menuItems);
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}
