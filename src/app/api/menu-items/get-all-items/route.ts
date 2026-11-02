import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { requireUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
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
