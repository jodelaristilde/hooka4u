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
  Users,
  Frame,
  Sparkles,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const firstName = session?.user?.name?.split(" ")[0];

  const buttons = [
    {
      title: "New Order",
      url: "/dashboard/new-order",
      icon: BookA,
      description: "Create and submit a new order",
    },
    {
      title: "All Orders",
      url: "/dashboard/all-orders",
      icon: ListOrdered,
      description: "View and manage all orders",
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
    <div className="min-h-screen bg-zinc-950">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 hidden text-zinc-400 hover:text-white hover:bg-zinc-800 sm:flex" />
          <Separator
            orientation="vertical"
            className="mr-2 bg-zinc-800 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="block">
                <BreadcrumbLink href="/" className="text-zinc-400 hover:text-white">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="block text-zinc-700" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-white">Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-8 p-4 pt-8 sm:p-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-lime-950/50 p-8">
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 animate-pulse rounded-full bg-lime-500/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-lime-400/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-2 text-lime-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-widest uppercase">
              VIP Service 4U
            </span>
          </div>
          <h2 className="relative mt-2 bg-gradient-to-r from-white via-white to-lime-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="relative mt-2 max-w-md text-sm text-zinc-400">
            Everything you need to run the floor tonight, all in one place.
          </p>
        </div>

        {/* Everything in one box */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-2xl shadow-black/40 sm:p-6">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/60 to-transparent"
            aria-hidden="true"
          />
          <h3 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Quick Access
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {buttons.map((item) => {
              const Icon = item.icon;
              const isDisabled = item.requiresAdmin && userRole !== "ADMIN";

              return (
                <a
                  key={item.title}
                  href={isDisabled ? "#" : item.url}
                  aria-disabled={isDisabled}
                  className={
                    isDisabled
                      ? "pointer-events-none flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 opacity-40"
                      : "group relative flex items-center gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-400/70 hover:bg-gradient-to-br hover:from-lime-500/10 hover:to-transparent hover:shadow-lg hover:shadow-lime-500/20"
                  }
                >
                  <span
                    className={
                      isDisabled
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700"
                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-lime-500/15 ring-1 ring-lime-500/30 transition-colors group-hover:bg-lime-500 group-hover:ring-lime-400"
                    }
                  >
                    <Icon
                      className={
                        isDisabled
                          ? "h-5 w-5 text-zinc-600"
                          : "h-5 w-5 text-lime-400 transition-colors group-hover:text-zinc-950"
                      }
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      {item.title}
                      {item.requiresAdmin && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-500/30">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-zinc-500">
                      {item.description}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
