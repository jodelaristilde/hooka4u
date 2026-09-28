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

      <div className="flex flex-1 flex-col gap-8 p-4 pt-8 sm:p-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-100 via-white to-lime-50 p-8 shadow-sm">
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 animate-pulse rounded-full bg-lime-300/40 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-lime-200/50 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-2 text-lime-700">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-widest uppercase">
              VIP Service 4U
            </span>
          </div>
          <h2 className="relative mt-2 bg-gradient-to-r from-zinc-900 to-lime-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="relative mt-2 max-w-md text-sm text-zinc-600">
            Everything you need to run the floor tonight, all in one place.
          </p>
        </div>

        {/* Everything in one box */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-200/50 sm:p-6">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-lime-500 to-lime-300"
            aria-hidden="true"
          />
          <h3 className="mb-4 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
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
                      ? "pointer-events-none flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 opacity-40"
                      : "group relative flex items-center gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-400 hover:bg-gradient-to-br hover:from-lime-50 hover:to-white hover:shadow-lg hover:shadow-lime-500/15"
                  }
                >
                  <span
                    className={
                      isDisabled
                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-200 ring-1 ring-zinc-300"
                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-lime-100 ring-1 ring-lime-300 transition-colors group-hover:bg-lime-500 group-hover:ring-lime-500"
                    }
                  >
                    <Icon
                      className={
                        isDisabled
                          ? "h-5 w-5 text-zinc-400"
                          : "h-5 w-5 text-lime-600 transition-colors group-hover:text-white"
                      }
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      {item.title}
                      {item.requiresAdmin && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-300">
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
