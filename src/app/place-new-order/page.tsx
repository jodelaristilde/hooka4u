import { headers } from "next/headers";
import OrderLanding from "@/components/order-landing";

// Same ordering system, same menu, same dashboard — just a different hero
// look depending on which domain the guest arrived through. Add more
// entries here as more branded domains point at this same site.
type Brand = {
  match: string;
  topLine?: string;
  bottomLine?: string;
  logoSrc?: string;
  subLine?: string;
  slogan?: string;
  theme: "dark-lime" | "dark-purple";
};

const BRANDS: Brand[] = [
  {
    match: "jaeky.us",
    logoSrc: "/jaeky-logo.png",
    subLine: "Got You",
    slogan: "Just About Everything, Kindly Yours",
    theme: "dark-purple",
  },
];

const DEFAULT_BRAND: Brand = {
  match: "",
  topLine: "Welcome To",
  bottomLine: "VIP SERVICE 4U",
  theme: "dark-lime",
};

export default async function Home() {
  const headersList = await headers();
  const host = (headersList.get("host") || "").toLowerCase();

  const brand = BRANDS.find((b) => host.includes(b.match)) || DEFAULT_BRAND;

  return (
    <OrderLanding
      topLine={brand.topLine}
      bottomLine={brand.bottomLine}
      logoSrc={brand.logoSrc}
      subLine={brand.subLine}
      slogan={brand.slogan}
      theme={brand.theme}
    />
  );
}
