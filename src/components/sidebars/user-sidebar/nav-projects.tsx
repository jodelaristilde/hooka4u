"use client"

import { useEffect, useState } from "react"
import { QrCode } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import Link from "next/link"

export function HomepageQR() {
  // `window.location` only exists in the browser, not on the server. Reading
  // it directly during render (the old `typeof window !== 'undefined'`
  // check) made the server draw this with an empty URL and the browser draw
  // it with the real URL, on the very first paint — a mismatch that crashed
  // hydration for the whole dashboard (not just this widget). Instead,
  // start with an empty URL on every render (server and client agree), and
  // fill it in only after the component has actually mounted in the
  // browser, which happens safely after that first-paint comparison.
  const [finalUrl, setFinalUrl] = useState("")

  useEffect(() => {
    setFinalUrl(`${window.location.origin}/place-new-order`)
  }, [])

  const getQRCodeUrl = () => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalUrl)}&bgcolor=ffffff&color=000000&qzone=1&format=svg`
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden mt-auto">
      <SidebarGroupLabel className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <QrCode className="h-3.5 w-3.5" />
        QR Code for Ordering Online
      </SidebarGroupLabel>

      <div className="flex flex-col items-center gap-3 px-2 py-3">
        <div className="rounded-lg border-2 border-border bg-white p-3 shadow-sm">
          <img
            draggable="false"
            src={getQRCodeUrl()}
            alt="QR code for ordering online"
            className="h-40 w-40"
          />
        </div>

        <Link
          href={finalUrl}
          className="w-full hover:underline rounded-md bg-muted px-2 py-1.5 text-center"
        >
          <code className="text-[10px] text-wrap text-muted-foreground break-all">
            {finalUrl}
          </code>
        </Link>
      </div>
    </SidebarGroup>
  )
}
