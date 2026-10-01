import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteFromRequest, siteWhere } from "@/lib/site";

// One-time cleanup helper: bulk-assigns every menu item on this site that
// has no recorded creator yet (items added before per-user tracking
// existed) to a chosen username. Used once from the admin Menu page's
// "Unassigned" filter, so old items like Karen's original 4 can be tagged
// as hers without anyone needing to re-create them.
export async function POST(request: Request) {
  try {
    const site = getSiteFromRequest(request);
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "A username is required" },
        { status: 400 }
      );
    }

    const result = await prisma.menuItems.updateMany({
      where: {
        ...siteWhere(site),
        createdByUsername: null,
      },
      data: {
        createdByUsername: username,
      },
    });

    return NextResponse.json({ success: true, updatedCount: result.count });
  } catch (error) {
    console.error("Error assigning menu item owner:", error);
    return NextResponse.json(
      { error: "Failed to assign items" },
      { status: 500 }
    );
  }
}
