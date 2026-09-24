import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"

const prisma = new PrismaClient()

export async function GET() {
  const newPassword = "NewPassword123"

  const existing = await prisma.user.findUnique({ where: { username: "admin" } })

  if (!existing) {
    await prisma.user.create({
      data: {
        username: "admin",
        password: newPassword,
        name: "Admin",
        role: "ADMIN",
      },
    })
    return NextResponse.json({ message: "Admin created. Username: admin, Password: " + newPassword })
  }

  await prisma.user.update({
    where: { username: "admin" },
    data: { password: newPassword },
  })

  return NextResponse.json({ message: "Password reset. Username: admin, Password: " + newPassword })
}
