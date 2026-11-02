// app/api/menu-templates/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { storeImage } from "@/lib/image-storage";
import { getSiteFromHost } from "@/lib/site";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, image, category } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const template = await prisma.menuItemTemplate.update({
      where: { id },
      data: {
        name: String(name).trim(),
        description: description || null,
        image: (await storeImage(image, getSiteFromHost(request.headers.get("host")))) || null,
        category: category || null,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating menu template:", error);
    return NextResponse.json(
      { error: "Failed to update menu template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await prisma.menuItemTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting menu template:", error);
    return NextResponse.json(
      { error: "Failed to delete menu template" },
      { status: 500 }
    );
  }
}
