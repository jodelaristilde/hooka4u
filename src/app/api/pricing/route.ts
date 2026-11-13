import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest } from "@/lib/site";

// Public (guests aren't logged in): how much higher card prices are, so the
// guest menu can show both the cash and the card price.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const site = getSiteFromRequest(request);
    const row = await prisma.siteSetting.findFirst({ where: { site }, select: { cardPricePercent: true } });
    return NextResponse.json({ cardPricePercent: row?.cardPricePercent ?? 0 });
  } catch {
    return NextResponse.json({ cardPricePercent: 0 });
  }
}
