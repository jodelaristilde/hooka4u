import { AppSidebar } from "@/components/sidebars/user-sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { EnlargeToggle } from "@/components/enlarge-toggle";
import type { Metadata } from "next";
import "../../globals.css";
import { cookies, headers } from "next/headers";
import { getBrandFromHost } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const brand = getBrandFromHost(headersList.get("host"));
  return {
    title: `${brand.name} User Dashboard - Your Hookah, Your Way`,
    description: `${brand.name} User Dashboard`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "false";
  const headersList = await headers();
  const brand = getBrandFromHost(headersList.get("host"));

  return (
      <>
        {/* <ThemeContextProvider> */}
          <SidebarProvider
            defaultOpen={defaultOpen}
            className={brand.site === "jaeky" ? "bg-purple-500/50" : "bg-lime-500/50"}
          >
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
            <EnlargeToggle />
          </SidebarProvider>
        {/* </ThemeContextProvider> */}
      </>
  );
}
