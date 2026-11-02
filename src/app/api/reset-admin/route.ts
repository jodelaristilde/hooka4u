import { NextRequest, NextResponse } from "next/server"
import { randomBytes, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/passwords"

// Emergency admin password reset. This used to reset the admin password to
// a value written right here in the code for ANYONE who opened this
// address. Now it is switched off unless the site owner sets an
// ADMIN_RESET_KEY environment variable in Vercel and opens:
//   /api/reset-admin?key=<that key>
// It then sets a new random password and shows it once.
export async function GET(request: NextRequest) {
  const expected = process.env.ADMIN_RESET_KEY
  const given = new URL(request.url).searchParams.get("key") || ""
  const matches =
    !!expected &&
    expected.length >= 12 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))

  if (!matches) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const password = randomBytes(9).toString("base64url")
  const hashed = await hashPassword(password)
  const existing = await prisma.user.findUnique({ where: { username: "admin" } })

  if (!existing) {
    await prisma.user.create({
      data: { username: "admin", password: hashed, name: "Admin", role: "ADMIN" },
    })
  } else {
    await prisma.user.update({ where: { username: "admin" }, data: { password: hashed, role: "ADMIN" } })
  }

  return NextResponse.json({
    message: "Admin password reset. Write it down now; it won't be shown again. Then remove ADMIN_RESET_KEY in Vercel.",
    username: "admin",
    password,
  })
}
