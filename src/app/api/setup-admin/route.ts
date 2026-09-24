import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"

const prisma = new PrismaClient()

export async function GET() {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } })
  if (existing) {
    return NextResponse.json({ message: "Admin already exists. You're good to go." })
  }

  await prisma.user.create({
    data: {
      username: "admin",
      password: "ChangeThisPassword123",
      name: "Admin",
      role: "ADMIN",
    },
  })

  return NextResponse.json({ message: "Admin created! Username: admin, Password: ChangeThisPassword123" })
}
