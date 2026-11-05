"use client"

import { MoreHorizontal, QrCode, type LucideIcon } from "lucide-react"
import { useSession } from "next-auth/react"
import * as React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function MobileBottomNav({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    requiresAdmin?: boolean
  }[]
}) {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const [activeItem, setActiveItem] = React.useState<string | null>(null)
  const [isNavigating, setIsNavigating] = React.useState(false)
  
  // Get current URL path
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  // Filter items based on user role
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (item.requiresAdmin) {
        return userRole === "ADMIN"
      }
      return true
    })
  }, [items, userRole])

  // Guest-ordering link for the QR code in the "More" menu (browser only).
  const [guestUrl, setGuestUrl] = React.useState("")
  React.useEffect(() => {
    setGuestUrl(`${window.location.origin}/place-new-order`)
  }, [])

  // Show first 4 items, rest in "More" menu
  const visibleItems = filteredItems.slice(0, 4)
  const moreItems = filteredItems.slice(4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden z-50 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
      {/* Loading indicator */}
      {isNavigating && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
        </div>
      )}
      
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {/* All 4 visible items evenly spaced */}
        {visibleItems.map((item) => {
          const isActive = currentPath === item.url
          
          return (
            <a
              key={item.title}
              href={item.url}
              onClick={() => setIsNavigating(true)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 px-2 py-2 group"
            >
              {/* Active background */}
              {isActive && (
                <div className="absolute inset-0 mx-1 bg-primary/8 rounded-2xl transition-all duration-300" />
              )}
              
              <div className="relative">
                {item.icon && (
                  <item.icon 
                    className={`size-6 transition-all duration-300 ${
                      isActive 
                        ? "text-primary scale-105" 
                        : "text-muted-foreground/70 group-hover:text-foreground group-hover:scale-105"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
              </div>
              
              <span
                className={`text-[10px] font-semibold transition-all duration-300 ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground/60 group-hover:text-foreground"
                }`}
              >
                {item.title}
              </span>
              
              {/* Active indicator line at top */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary transition-all duration-300" />
              )}
            </a>
          )
        })}

        {/* More menu if needed */}
        {(moreItems.length > 0 || !!session?.user) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative flex flex-col items-center justify-center gap-1 flex-1 px-2 py-2 h-auto rounded-none hover:bg-transparent group"
              >
                <MoreHorizontal 
                  className="size-6 text-muted-foreground/70 group-hover:text-foreground transition-all duration-300 group-hover:scale-105" 
                  strokeWidth={2}
                />
                <span className="text-[10px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-all duration-300">
                  More
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 mb-2 rounded-2xl border-border/40 shadow-xl">
              {moreItems.map((item) => {
                const isActiveMore = currentPath === item.url
                
                return (
                  <DropdownMenuItem key={item.title} asChild>
                    <a 
                      href={item.url}
                      onClick={() => setIsNavigating(true)}
                      className={`flex items-center gap-3 cursor-pointer py-3 px-3.5 rounded-xl ${
                        isActiveMore ? 'bg-primary/8 text-primary' : ''
                      }`}
                    >
                      {item.icon && (
                        <item.icon 
                          className={`size-5 ${isActiveMore ? 'text-primary' : 'text-muted-foreground'}`} 
                          strokeWidth={isActiveMore ? 2.5 : 2} 
                        />
                      )}
                      <span className={`text-sm font-medium ${isActiveMore ? 'text-primary' : ''}`}>
                        {item.title}
                      </span>
                    </a>
                  </DropdownMenuItem>
                )
              })}
              {session?.user && guestUrl && (
                <>
                  {moreItems.length > 0 && <DropdownMenuSeparator />}
                  <div className="flex flex-col items-center gap-2 px-2 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <QrCode className="h-3.5 w-3.5" />
                      QR Code for Ordering Online
                    </span>
                    <div className="rounded-lg border-2 border-border bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        draggable="false"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(guestUrl)}&bgcolor=ffffff&color=000000&qzone=1&format=svg`}
                        alt="QR code for ordering online"
                        className="h-36 w-36"
                      />
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  )
}