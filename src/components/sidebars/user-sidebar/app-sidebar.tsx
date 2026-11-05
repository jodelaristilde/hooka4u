"use client"

import { BookA, Bot, DollarSign, Frame, GalleryVerticalEnd, Home, ImagePlus, Library, ListOrdered, Menu, MenuSquare, Users } from "lucide-react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import * as React from "react"
import { NavMain } from "@/components/sidebars/user-sidebar/nav-main"
import { HomepageQR } from "@/components/sidebars/user-sidebar/nav-projects"
import { NavUser } from "@/components/sidebars/user-sidebar/nav-user"
import { TeamSwitcher } from "@/components/sidebars/user-sidebar/team-switcher"
import { MobileBottomNav } from "@/components/sidebars/user-sidebar/mobile-bottom-nav"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useBrand } from "@/lib/use-brand"

// Sidebar static data (nav items only — the team name is now injected from
// the current site's brand at render time)
const sidebarData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "Add Items",
      url: "/dashboard/quick-add",
      icon: ImagePlus,
    },
    {
      title: "New Order",
      url: "/dashboard/new-order",
      icon: BookA,
      isActive: true,
    },
    {
      title: "All Orders",
      url: "/dashboard/all-orders",
      icon: ListOrdered,
    },
    {
      title: "Menu Prices",
      url: "/dashboard/menu-prices",
      icon: DollarSign,
    },
    {
      title: "Menu",
      url: "/dashboard/menu",
      icon: Menu,
    },
    {
      title: "Item Library",
      url: "/dashboard/item-library",
      icon: Library,
      requiresAdmin: true,
    },
    {
      title: "Users Management",
      url: "/dashboard/users-management",
      icon: Users,
      requiresAdmin: true,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const isMobile = useIsMobile()
  const brand = useBrand()
  const team = { name: brand.name, logo: GalleryVerticalEnd, plan: "Enterprise" }

  // Map NextAuth user to NavUser props
  const user = session?.user
    ? {
        name: session.user.name ?? "Guest",
        email: session.user.username ?? "",
        avatar: session.user.image ?? "/avatars/default.jpg",
      }
    : {
        name: "Guest",
        email: "",
        avatar: "/avatars/default.jpg",
      }

  // Filter navigation items based on user role
  const filteredNavMain = React.useMemo(() => {
    const userRole = session?.user?.role
    return sidebarData.navMain.filter((item) => {
      if (item.requiresAdmin) {
        return userRole === "ADMIN"
      }
      return true
    })
  }, [session?.user?.role])

  // The step-by-step Add Items screen is a full-screen flow with its own
  // "More" menu, so no sidebar or bottom bar there.
  const pathname = usePathname()
  if (pathname?.startsWith("/dashboard/quick-add")) {
    return null
  }

  if (isMobile) {
    return (
      <>
        <MobileBottomNav items={filteredNavMain} />
        {/* Add padding to main content to avoid overlap with bottom nav */}
        <div className="pb-20" />
      </>
    )
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher team={team} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
        {/* Guest-ordering QR code: shown to every logged-in user (staff too). */}
        {session?.user && <HomepageQR/>}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
