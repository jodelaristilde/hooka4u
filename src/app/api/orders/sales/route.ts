import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { isAdminSession, requireUser } from "@/lib/api-auth";
import { verifyPassword } from "@/lib/passwords";
import { startOfTonight } from "@/lib/night-report";

// Tonight's sales WITH prices, for the "double-tap Total" panel.
// Admins get it straight away. On a staff login, an admin password must be
// typed (so the owner can check the total on any staff phone/iPad, while
// staff themselves still never see prices).
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    // "Tonight" starts at 6 AM on the device's own clock, so the phone sends
    // when that was (the server's clock may be in a different time zone).
    const sinceDate = typeof body.since === "string" ? new Date(body.since) : null;
    const since = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : startOfTonight();

    if (!isAdminSession(auth)) {
      const password = body.password;
      if (typeof password !== "string" || !password) {
        return NextResponse.json({ error: "Enter an admin password." }, { status: 400 });
      }
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { password: true } });
      let ok = false;
      for (const a of admins) {
        if ((await verifyPassword(password, a.password)).ok) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        return NextResponse.json({ error: "That's not an admin password." }, { status: 401 });
      }
    }

    const site = getSiteFromRequest(request);
    const orders = await prisma.order.findMany({
      where: { AND: [siteWhere(site), { createdAt: { gte: since } }] },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      orders.map((o) => ({ ...o, paymentType: o.paymentType || "CASH" }))
    );
  } catch (err) {
    console.error("Error loading sales:", err);
    return NextResponse.json({ error: "Couldn't load tonight's sales." }, { status: 500 });
  }
}
