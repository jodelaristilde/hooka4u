import { GalleryVerticalEnd } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { headers } from "next/headers";

// Same login system for both domains — only the branding on this page
// (the little corner logo and the right-hand dark panel) changes
// depending on which domain the admin is logging in from. Jaeky's logo
// image already has "GOT YOU" and the tagline baked into the graphic, so
// no separate text is needed next to it here.
export default async function LoginPage() {
  const headersList = await headers();
  const host = (headersList.get("host") || "").toLowerCase();
  const isJaeky = host.includes("jaeky.us");

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link
          href="/login"
          className={`flex items-center gap-2 font-medium ${
            isJaeky ? "justify-center sm:justify-start w-full sm:w-auto" : ""
          }`}
        >
          {isJaeky ? (
            // Dark (black + purple) version of the logo here specifically —
            // this corner sits on a white background, so the white/purple
            // version used elsewhere (dark backgrounds) would be nearly
            // invisible. Centered on mobile (where it's the only thing at
            // the top of the screen); left-aligned in the corner once the
            // two-column desktop layout kicks in.
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/jaeky-logo-dark.png" alt="Jaeky" className="h-20 sm:h-24 w-auto" />
          ) : (
            <>
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md flex-col">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <b>VIPService4U</b>
            </>
          )}
        </Link>

        {/* Login form */}
        <div className="flex flex-col flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm isJaeky={isJaeky} />
            <div className="mt-4 text-center text-sm text-zinc-500">
              Having trouble logging in?{" "}
              <Link
                href="mailto:aimahusnain@gmail.com"
                className="text-primary underline"
                target="_blank"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex items-center justify-center p-12 bg-black">
        {isJaeky ? (
          <div className="max-w-lg text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/jaeky-logo.png"
              alt="Jaeky"
              className="mx-auto w-full max-w-md h-auto"
            />
          </div>
        ) : (
          <div className="max-w-lg space-y-8">
            <div className="h-1 w-12 bg-white"></div>
            <h2 className="text-4xl font-light text-white leading-tight tracking-tight">
              Streamlined ordering for your team
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed font-light">
              Users can only log in using the credentials provided by the admin,
              after which they can browse items, select what they need, and place
              their orders easily.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
