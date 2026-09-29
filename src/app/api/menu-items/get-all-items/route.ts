import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

export async function GET(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const allItems = await prisma.menuItems.findMany({
      where: siteWhere(site),
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(allItems);
  } catch (error) {
    console.error('Error details:', error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
      { status: 500 }
    );
  }
}
