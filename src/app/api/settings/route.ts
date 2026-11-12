import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest } from "@/lib/site";
import { requireAdmin, requireUser } from "@/lib/api-auth";

// Site switches the admin controls (e.g. "Print a ticket when an order is
// Ready"). Staff can read them; only an admin can change them.
export const dynamic = "force-dynamic";

const DEFAULTS = { printTickets: false, requirePayment: false };

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const site = getSiteFromRequest(request);
    const row = await prisma.siteSetting.findFirst({ where: { site } });
    return NextResponse.json({
      printTickets: row?.printTickets ?? DEFAULTS.printTickets,
      requirePayment: row?.requirePayment ?? DEFAULTS.requirePayment,
    });
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
    const data: { printTickets?: boolean; requirePayment?: boolean } = {};
    if (typeof body.printTickets === "boolean") data.printTickets = body.printTickets;
    if (typeof body.requirePayment === "boolean") data.requirePayment = body.requirePayment;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }
    const existing = await prisma.siteSetting.findFirst({ where: { site } });
    const row = existing
      ? await prisma.siteSetting.update({ where: { id: existing.id }, data })
      : await prisma.siteSetting.create({ data: { site, ...data } });
    return NextResponse.json({ printTickets: row.printTickets, requirePayment: row.requirePayment });
  } catch (err) {
    console.error("Error saving settings:", err);
    return NextResponse.json({ error: "Could not save the setting." }, { status: 500 });
  }
}
