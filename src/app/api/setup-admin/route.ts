import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/passwords"

// First-time setup only. This used to create (or confirm) an "admin"
// account with a password written right here in the code, so anyone who
// found this address could log in as admin. Now it only does anything when
// the site has NO admin account at all, and it creates one with a random
// password that's shown once.
export async function GET() {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } })
  if (adminCount > 0) {
    return NextResponse.json({ message: "Setup is already done." }, { status: 404 })
  }

  const password = randomBytes(9).toString("base64url")
  await prisma.user.create({
    data: {
      username: "admin",
      password: await hashPassword(password),
      name: "Admin",
      role: "ADMIN",
    },
  })

  return NextResponse.json({
    message: "Admin created. Write this password down now; it won't be shown again.",
    username: "admin",
    password,
  })
}
