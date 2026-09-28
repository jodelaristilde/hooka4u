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
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookA,
  ListOrdered,
  DollarSign,
  Menu,
  Users,
  Frame,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const firstName = session?.user?.name?.split(" ")[0];

  const navMain = [
    {
      title: "New Order",
      url: "/dashboard/new-order",
      icon: BookA,
      description: "Create and submit a new order",
      isActive: true,
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
  ];

  const projects = [
    {
      name: "Place New Order (Guest)",
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

      <div className="flex flex-1 flex-col gap-10 p-4 pt-8 sm:p-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-lime-950/40 p-8">
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-lime-500/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-2 text-lime-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-widest uppercase">
              VIP Service 4U
            </span>
          </div>
          <h2 className="relative mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="relative mt-2 max-w-md text-sm text-zinc-400">
            Quick access to everything you need to run the floor tonight.
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Main Navigation
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {navMain.map((item) => {
                const Icon = item.icon;
                const isDisabled = item.requiresAdmin && userRole !== "ADMIN";

                return (
                  <a
                    key={item.title}
                    href={isDisabled ? "#" : item.url}
                    className={
                      isDisabled
                        ? "group pointer-events-none opacity-40"
                        : "group"
                    }
                  >
                    <Card className="border-zinc-800 bg-zinc-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/60 hover:shadow-lg hover:shadow-lime-500/10">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-lime-500/10 p-2 ring-1 ring-lime-500/20">
                              <Icon
                                className={
                                  isDisabled
                                    ? "h-5 w-5 text-zinc-600"
                                    : "h-5 w-5 text-lime-400"
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="flex items-center gap-2 text-base text-white">
                                {item.title}
                                {item.requiresAdmin && (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-400 ring-1 ring-amber-500/30">
                                    Admin
                                  </span>
                                )}
                              </CardTitle>
                              <CardDescription className="text-xs text-zinc-500">
                                {item.description}
                              </CardDescription>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" />
                        </div>
                      </CardHeader>
                    </Card>
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
              Quick Actions
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((item) => {
                const Icon = item.icon;
                return (
                  <a key={item.name} href={item.url} className="group">
                    <Card className="border-zinc-800 bg-zinc-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-500/60 hover:shadow-lg hover:shadow-lime-500/10">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-lime-500/10 p-2 ring-1 ring-lime-500/20">
                              <Icon className="h-5 w-5 text-lime-400" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base text-white">
                                {item.name}
                              </CardTitle>
                              <CardDescription className="text-xs text-zinc-500">
                                {item.description}
                              </CardDescription>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-lime-400" />
                        </div>
                      </CardHeader>
                    </Card>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
