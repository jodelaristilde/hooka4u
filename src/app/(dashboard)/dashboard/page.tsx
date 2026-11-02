import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  BookA,
  ListOrdered,
  DollarSign,
  Menu,
  Library,
  Users,
  Frame,
  Sparkles,
  ImagePlus,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";
import { getBrandFromHost } from "@/lib/brand";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const firstName = session?.user?.name?.split(" ")[0];
  const headersList = await headers();
  const brand = getBrandFromHost(headersList.get("host"));

  const isJaeky = brand.site === "jaeky";

  const buttons: {
    title: string;
    url: string;
    icon: typeof BookA;
    description: string;
    requiresAdmin?: boolean;
    featured?: boolean;
  }[] = [
    {
      title: "Add Items",
      url: "/dashboard/quick-add",
      icon: ImagePlus,
      description: "Photo, category, price. Done.",
      requiresAdmin: true,
      featured: true,
    },
    {
      title: "New Order",
      url: "/dashboard/new-order",
      icon: BookA,
      description: "Staff place orders on iPad or phone",
    },
    {
      title: "All Orders",
      url: "/dashboard/all-orders",
      icon: ListOrdered,
      description: "View orders",
    },
    {
      title: "Menu Prices",
      url: "/dashboard/menu-prices",
      icon: DollarSign,
      description: "Check current menu pricing",
    },
    {
      title: "Menu",
      url: "/dashboard/menu",
      icon: Menu,
      description: "Manage menu items and categories",
    },
    {
      title: "Item Library",
      url: "/dashboard/item-library",
      icon: Library,
      description: "Save photos & details to reuse on the menu later",
      requiresAdmin: true,
    },
    {
      title: "Users Management",
      url: "/dashboard/users-management",
      icon: Users,
      description: "Administer user accounts and permissions",
      requiresAdmin: true,
    },
    {
      title: "Guest Ordering",
      url: "/place-new-order",
      icon: Frame,
      description: "Quick order placement without login",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 hidden text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 sm:flex" />
          <Separator
            orientation="vertical"
            className="mr-2 bg-zinc-200 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="block">
                <BreadcrumbLink href="/" className="text-zinc-500 hover:text-zinc-900">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="block text-zinc-300" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-zinc-900">Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-8 p-4 pt-8 pb-28 sm:p-8 sm:pb-28 md:pb-8">
        {/* Hero */}
        <div className={`relative overflow-hidden rounded-2xl border ${brand.accentBorder} bg-gradient-to-br ${brand.bannerGradient} p-6 shadow-sm sm:p-8`}>
          <div
            className={`pointer-events-none absolute -top-24 -right-24 h-72 w-72 animate-pulse rounded-full ${brand.accentBg} blur-3xl`}
            style={{ opacity: 0.4 }}
            aria-hidden="true"
          />
          <div
            className={`pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full ${brand.accentBgSoft} blur-3xl`}
            style={{ opacity: 0.5 }}
            aria-hidden="true"
          />
          {isJaeky ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/jaeky-wordmark-transparent.png"
              alt="Jaeky"
              className="relative h-16 w-auto sm:h-20"
            />
          ) : (
            <div className={`relative flex items-center gap-2 ${brand.accentTextStrong}`}>
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-widest uppercase">
                {brand.name}
              </span>
            </div>
          )}
          {/* One line on every screen size: the text shrinks with the screen
              width instead of wrapping. */}
          <p className="relative mt-3 text-[clamp(0.95rem,4.4vw,2rem)] leading-tight font-bold tracking-tight whitespace-nowrap text-zinc-900">
            {brand.tagline}
          </p>
          <h2 className={`relative mt-3 text-lg font-semibold sm:text-xl ${brand.accentTextStrong}`}>
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h2>
        </div>

        {/* Every page, on one screen, as big tiles. Add Items is first and
            filled in so it stands out. Admin-only tiles stay greyed out for
            everyone else, same as before. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {buttons.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.requiresAdmin && userRole !== "ADMIN";

            const tileClass = isDisabled
              ? "pointer-events-none flex min-h-40 flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-100 p-4 opacity-50 sm:min-h-44 sm:p-5"
              : item.featured
                ? isJaeky
                  ? "group flex min-h-40 flex-col justify-between gap-4 rounded-2xl bg-purple-700 p-4 text-white shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 sm:min-h-44 sm:p-5"
                  : "group flex min-h-40 flex-col justify-between gap-4 rounded-2xl bg-lime-700 p-4 text-white shadow-lg shadow-lime-500/25 transition-all hover:-translate-y-0.5 hover:bg-lime-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-300 sm:min-h-44 sm:p-5"
                : isJaeky
                  ? "group flex min-h-40 flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 sm:min-h-44 sm:p-5"
                  : "group flex min-h-40 flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-lime-400 hover:shadow-lg hover:shadow-lime-500/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-300 sm:min-h-44 sm:p-5";

            const iconClass = isDisabled
              ? "flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500"
              : item.featured
                ? "flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white"
                : isJaeky
                  ? "flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-700 transition-colors group-hover:bg-purple-700 group-hover:text-white"
                  : "flex h-12 w-12 items-center justify-center rounded-xl bg-lime-100 text-lime-800 transition-colors group-hover:bg-lime-700 group-hover:text-white";

            return (
              <a
                key={item.title}
                href={isDisabled ? undefined : item.url}
                aria-disabled={isDisabled || undefined}
                className={tileClass}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={iconClass}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  {item.requiresAdmin && !item.featured && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300">
                      Admin
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-base leading-tight font-bold sm:text-lg">{item.title}</span>
                  <span
                    className={`line-clamp-2 text-xs sm:text-sm ${
                      item.featured && !isDisabled ? "text-white/85" : "text-zinc-600"
                    }`}
                  >
                    {item.description}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
