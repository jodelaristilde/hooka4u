import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import "./homepagecss.css";
import { Toaster } from "@/components/ui/sonner";
import AuthProvider from "@/components/auth-provider";
import { headers } from "next/headers";
import { getBrandFromHost } from "@/lib/brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dynamic (per-request) so the browser tab title/description switch to
// Jaeky's branding on jaeky.us. Nested layouts (e.g. the dashboard's) can
// still override this for their own section.
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const brand = getBrandFromHost(headersList.get("host"));
  return {
    title: `${brand.name} - Your Hookah, Your Way`,
    description: "Your Hookah, Your Way",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brand.name,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} overflow-x-hidden antialiased`}
      >
        {/* <ThemeContextProvider> */}
          <Toaster theme="light" />
          <AuthProvider>{children}</AuthProvider>
        {/* </ThemeContextProvider> */}
      </body>
    </html>
  );
}
