import { headers } from "next/headers";
import OrderLanding from "@/components/order-landing";

// Same ordering system, same menu, same dashboard — just a different hero
// greeting depending on which domain the guest arrived through. Add more
// entries here as more branded domains point at this same site.
const BRANDS: { match: string; topLine: string; bottomLine: string }[] = [
  { match: "jaeky.us", topLine: "Jaeky", bottomLine: "GOT YOU" },
];

const DEFAULT_BRAND = { topLine: "Welcome To", bottomLine: "VIP SERVICE 4U" };

export default async function Home() {
  const headersList = await headers();
  const host = (headersList.get("host") || "").toLowerCase();

  const brand = BRANDS.find((b) => host.includes(b.match)) || DEFAULT_BRAND;

  return <OrderLanding topLine={brand.topLine} bottomLine={brand.bottomLine} />;
}
