import { headers } from "next/headers";
import OrderLanding from "@/components/order-landing";

// Same ordering system, same menu, same dashboard — just a different hero
// look depending on which domain the guest arrived through. Add more
// entries here as more branded domains point at this same site.
//
// Jaeky's logo is split into two image pieces (the "JaeKy" wordmark, and
// the "Just About Everything, Kindly Yours" tagline) so "GOT YOU" can be
// rendered as live text in between them, in the matching font/color.
// White background, light-purple theme.
type Brand = {
  match: string;
  topLine?: string;
  bottomLine?: string;
  logoSrc?: string;
  subLine?: string;
  taglineSrc?: string;
  logoAlt?: string;
  theme: "dark-lime" | "dark-purple" | "light-purple" | "light-green" | "dark-gold";
};

const BRANDS: Brand[] = [
  {
    match: "jaeky.us",
    logoSrc: "/jaeky-wordmark-only.png",
    subLine: "Got You",
    taglineSrc: "/jaeky-tagline-only.png",
    logoAlt: "Jaeky",
    theme: "light-purple",
  },
];

// VIP Service 4U: gold logo, black & gold club look.
const DEFAULT_BRAND: Brand = {
  match: "",
  logoSrc: "/vipservice4u-logo-gold.png",
  logoAlt: "VIP Service 4U",
  theme: "dark-gold",
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
      taglineSrc={brand.taglineSrc}
      logoAlt={brand.logoAlt}
      theme={brand.theme}
    />
  );
}
