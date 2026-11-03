import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest } from "@/lib/site";
import { requireAdmin, requireUser } from "@/lib/api-auth";

// Site switches the admin controls (e.g. "Print a ticket when an order is
// Ready"). Staff can read them; only an admin can change them.
export const dynamic = "force-dynamic";

const DEFAULTS = { printTickets: false };

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const site = getSiteFromRequest(request);
    const row = await prisma.siteSetting.findFirst({ where: { site } });
    return NextResponse.json({ printTickets: row?.printTickets ?? DEFAULTS.printTickets });
  } catch (err) {
    console.error("Error reading settings:", err);
    return NextResponse.json(DEFAULTS);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const site = getSiteFromRequest(request);
    const body = await request.json().catch(() => ({}));
    if (typeof body.printTickets !== "boolean") {
      return NextResponse.json({ error: "printTickets must be true or false" }, { status: 400 });
    }
    const existing = await prisma.siteSetting.findFirst({ where: { site } });
    const row = existing
      ? await prisma.siteSetting.update({ where: { id: existing.id }, data: { printTickets: body.printTickets } })
      : await prisma.siteSetting.create({ data: { site, printTickets: body.printTickets } });
    return NextResponse.json({ printTickets: row.printTickets });
  } catch (err) {
    console.error("Error saving settings:", err);
    return NextResponse.json({ error: "Could not save the setting." }, { status: 500 });
  }
}
