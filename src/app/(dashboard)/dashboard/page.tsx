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
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

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
    <div>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 hidden sm:flex" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="block"><BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Overview</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-8 p-4 pt-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-muted-foreground">
            Quick access to your dashboard features
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Main Navigation
            </h3>
            <div className="difference">
</parameter>
