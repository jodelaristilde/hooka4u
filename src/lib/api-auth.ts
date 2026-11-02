// src/lib/api-auth.ts
//
// Login checks for API routes. Every route that changes data, or returns
// private data (orders, users, prices, backups), starts with one of these.
// Guest-facing routes (viewing the menu, placing an order, checking an
// order's status) stay public on purpose.
//
//   const auth = await requireUser();
//   if (auth instanceof NextResponse) return auth;   // 401, not logged in
//
//   const auth = await requireAdmin();
//   if (auth instanceof NextResponse) return auth;   // 401 / 403

import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireUser(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  return session;
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please log in." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return session;
}

export function isAdminSession(session: Session | null | undefined): boolean {
  return session?.user?.role === "ADMIN";
}
