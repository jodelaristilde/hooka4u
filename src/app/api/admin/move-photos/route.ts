import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { getSiteFromRequest, siteWhere } from "@/lib/site";
import { imageStorageEnabled, storeImage } from "@/lib/image-storage";

// Moves photos that are still saved inside the database (as "data:" text)
// out to image storage, a small batch per call so it never times out. The
// Users Management page calls this repeatedly until `remaining` is 0.
// Only this site's items are touched.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 12;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const site = getSiteFromRequest(request);
  const inDb = { image: { startsWith: "data:" }, ...siteWhere(site) };
  const [items, library] = await Promise.all([
    prisma.menuItems.count({ where: inDb }),
    prisma.menuItemTemplate.count({ where: inDb }),
  ]);
  return NextResponse.json({ enabled: imageStorageEnabled(), remaining: items + library });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    if (!imageStorageEnabled()) {
      return NextResponse.json(
        {
          error:
            "Image storage isn't connected yet. In Vercel open this project → Storage → Blob → Create / Connect, then redeploy.",
        },
        { status: 400 }
      );
    }

    const site = getSiteFromRequest(request);
    const inDb = { image: { startsWith: "data:" }, ...siteWhere(site) };
    let moved = 0;

    const items = await prisma.menuItems.findMany({ where: inDb, select: { id: true, image: true }, take: BATCH });
    for (const item of items) {
      const url = await storeImage(item.image, site);
      if (url && url !== item.image) {
        await prisma.menuItems.update({ where: { id: item.id }, data: { image: url } });
        moved++;
      }
    }

    const left = BATCH - items.length;
    if (left > 0) {
      const templates = await prisma.menuItemTemplate.findMany({ where: inDb, select: { id: true, image: true }, take: left });
      for (const t of templates) {
        const url = await storeImage(t.image, site);
        if (url && url !== t.image) {
          await prisma.menuItemTemplate.update({ where: { id: t.id }, data: { image: url } });
          moved++;
        }
      }
    }

    const [itemsLeft, libraryLeft] = await Promise.all([
      prisma.menuItems.count({ where: inDb }),
      prisma.menuItemTemplate.count({ where: inDb }),
    ]);
    return NextResponse.json({ moved, remaining: itemsLeft + libraryLeft });
  } catch (error) {
    console.error("Error moving photos:", error);
    return NextResponse.json({ error: "Couldn't move photos. Try again." }, { status: 500 });
  }
}
