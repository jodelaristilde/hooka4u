"use client";
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  ShoppingBag,
  Clock,
  Package,
  CreditCard,
  Banknote,
  MapPin,
  Trash2,
  Bell,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useBrand } from "@/lib/use-brand";
import { useSession } from "next-auth/react";
import { useShiftMode } from "@/lib/use-shift-mode";
import { buildNightReport, downloadNightReport, todaysOrders as ordersSinceMidnight } from "@/lib/night-report";

interface OrderItem {
  id: string;
  quantity: number;
  // Optional/nullable: if the underlying menu item was later deleted from
  // the admin Menu page, the API can return this as null for that item.
  product: {
    id: string;
    name: string;
    price: number;
  } | null;
}

interface Order {
  id: string;
  orderNumber?: number | null;
  customerName: string;
  subtotal: number;
  createdAt: string;
  items: OrderItem[];
  paymentType?: "CASH" | "CARD";
  Seating?: string;
  status?: "PENDING" | "DELIVERED";
}

export default function AllOrders() {
  const brand = useBrand();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  // Orders this device has accepted ("View order" or tapping the card).
  // Saved on the device so a reload or a phone waking up never treats a new
  // order as already seen. Any pending order NOT in here alerts.
  const [ackedIds, setAckedIds] = useState<Record<string, number>>({});
  const [ackedLoaded, setAckedLoaded] = useState(false);
  const [productImages, setProductImages] = useState<Record<string, string>>(
    {}
  );
  // The order grid now shows small, compact cards (so more fit on a small
  // monitor). Tapping a card opens this order's full details — items,
  // images, prices — in a dialog instead of cramming all of that onto
  // every card all the time. Storing just the id (and looking the order
  // back up from the live `orders` list below) means the dialog always
  // shows this order's current status, even while it's open and the
  // 5-second poll brings in an update.
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  // Admin-only "today's sales" panel, opened by double-tapping Total.
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [salesOpen, setSalesOpen] = useState(false);
  const lastTotalTapRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  // Orders that already got their first chime on this page, so a new one
  // chimes right away and older waiting ones just keep looping.
  const alertedRef = useRef<Set<string>>(new Set());
  const alertLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // One tap turns on the sound and keeps the screen awake for the shift.
  const { shiftOn, screenAwake, startShift } = useShiftMode();
  const unlockSound = async () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      await audioCtxRef.current?.resume();
    } catch {
      // Web Audio not available; the plain beep is the fallback.
    }
    const a = audioRef.current;
    if (a) {
      await a.play().catch(() => {});
      a.pause();
      a.currentTime = 0;
    }
  };

  // This page is only ever meaningful once it's running in the browser (it
  // fetches its own data on mount). Rendering it for real on the server
  // first and then swapping it for the browser's version can, in some
  // cases, produce a mismatch that React refuses to recover from, leaving
  // this whole page blank. Sidestep that entirely: render nothing but a
  // simple loading spinner until the very first moment we're confirmed to
  // be running in the browser, then render everything as normal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGWe77OVvSxMLT6Xl8Lhb"
    );

    fetchOrders();
    fetchProductImages();
    requestNotificationPermission();

    // Browsers block audio from playing automatically until the page has
    // had at least one real click/tap/keypress. "Unlock" it as early as
    // possible (silently play + immediately pause) on the first
    // interaction, so the alert sound actually plays later when a new
    // order comes in with no direct click on the audio itself.
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx) audioCtxRef.current = new Ctx();
        }
        audioCtxRef.current?.resume().catch(() => {});
      } catch {
        // Web Audio not available; the plain beep below is the fallback.
      }
      if (audioUnlockedRef.current || !audioRef.current) return;
      audioRef.current
        .play()
        .then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.currentTime = 0;
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          // Still locked; a later real interaction will retry.
        });
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    const pollInterval = setInterval(() => {
      fetchOrdersQuietly();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      if (alertLoopRef.current) {
        clearInterval(alertLoopRef.current);
        alertLoopRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const ackStorageKey = `orders-acked:${brand.site}`;
  // Load what this device already accepted (last 24 hours only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ackStorageKey);
      const parsed: Record<string, number> = raw ? JSON.parse(raw) : {};
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const kept: Record<string, number> = {};
      for (const [id, at] of Object.entries(parsed)) if (typeof at === "number" && at > cutoff) kept[id] = at;
      setAckedIds(kept);
    } catch {
      setAckedIds({});
    }
    setAckedLoaded(true);
  }, [ackStorageKey]);

  // Accept one order: stops its alert. The others keep alerting.
  const ackOrder = (id: string) => {
    setAckedIds((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: Date.now() };
      try {
        window.localStorage.setItem(ackStorageKey, JSON.stringify(next));
      } catch {
        // Storage blocked (private mode): still works until the page reloads.
      }
      return next;
    });
  };

  const showBrowserNotification = (newOrder: Order) => {
    if ("Notification" in window && Notification.permission === "granted") {
      // No price here: staff don't see prices.
      new Notification("🔔 New Order Received!", {
        body: `Order from ${newOrder.customerName || "Guest"}${
          newOrder.Seating ? ` · ${newOrder.Seating}` : ""
        }`,
        icon: "/notification-icon.png",
        badge: "/badge-icon.png",
        tag: newOrder.id,
      });
    }
  };

  const playNotificationSound = () => {
    // Two-note chime, loud enough to hear in a busy room.
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "running") {
      const t0 = ctx.currentTime;
      [
        { freq: 880, at: 0 },
        { freq: 1318.5, at: 0.18 },
        { freq: 880, at: 0.5 },
        { freq: 1318.5, at: 0.68 },
      ].forEach(({ freq, at }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + at);
        gain.gain.exponentialRampToValueAtTime(0.6, t0 + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + at);
        osc.stop(t0 + at + 0.32);
      });
      if ("vibrate" in navigator) navigator.vibrate?.([250, 120, 250]);
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
    }
  };

  const startAlertLoop = () => {
    if (alertLoopRef.current) return; // already looping
    alertLoopRef.current = setInterval(() => {
      playNotificationSound();
    }, 2000);
  };

  const stopAlertLoop = () => {
    if (alertLoopRef.current) {
      clearInterval(alertLoopRef.current);
      alertLoopRef.current = null;
    }
  };

  // Fetch the product catalog's images once (it rarely changes) and build
  // a lookup map, instead of the orders endpoint re-sending every image
  // over and over with every order, on every 5-second refresh.
  const fetchProductImages = async () => {
    try {
      const response = await fetch("/api/menu-items/get-all-items");
      if (!response.ok) return;
      const items = await response.json();
      if (!Array.isArray(items)) return;

      const map: Record<string, string> = {};
      for (const item of items) {
        if (item?.id && item?.image) {
          map[item.id] = item.image;
        }
      }
      setProductImages(map);
    } catch (err) {
      console.error("Error fetching product images:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/orders/get", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      const data = await response.json();
      const fetchedOrders = Array.isArray(data) ? data : [];

      setOrders(fetchedOrders);
      setLastFetchTime(new Date());

      if (isInitialLoadRef.current) {
        previousOrderIdsRef.current = new Set(
          fetchedOrders.map((o: Order) => o.id)
        );
        isInitialLoadRef.current = false;
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersQuietly = async () => {
    try {
      const response = await fetch("/api/orders/get", { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      const fetchedOrders = Array.isArray(data) ? data : [];

      const currentOrderIds = new Set(fetchedOrders.map((o: Order) => o.id));
      setOrders(fetchedOrders);
      previousOrderIdsRef.current = currentOrderIds;
      setLastFetchTime(new Date());
    } catch (err) {
      console.error("Error fetching orders quietly:", err);
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/orders?id=${orderToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete order");
      }

      setOrders((prevOrders) =>
        prevOrders.filter((o) => o.id !== orderToDelete.id)
      );
      previousOrderIdsRef.current.delete(orderToDelete.id);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (err) {
      console.error("Error deleting order:", err);
      setError(err instanceof Error ? err.message : "Failed to delete order");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return "Just now";
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getTimeSinceLastFetch = () => {
    if (!lastFetchTime) return "Never";
    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - lastFetchTime.getTime()) / 1000
    );

    if (diffInSeconds < 10) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  };

  const getTotalItems = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleStatusToggle = async (order: Order) => {
    const newStatus = order.status === "DELIVERED" ? "PENDING" : "DELIVERED";

    try {
      setUpdatingStatus(order.id);
      const response = await fetch(`/api/orders/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === order.id ? { ...o, status: newStatus } : o
        )
      );
    } catch (err) {
      console.error("Error updating order status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update order status"
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const pendingOrders = orders.filter(
    (o) => !o.status || o.status === "PENDING"
  );
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED");
  const expandedOrder = orders.find((o) => o.id === expandedOrderId) ?? null;

  // Every pending order this device hasn't accepted yet alerts (pop-up +
  // repeating chime), oldest first, until someone taps "View order" or its
  // card. Based on what's saved on the device, so orders that came in while
  // the page was asleep or reloading still alert. Orders older than 6 hours
  // are left alone.
  const nowMs = lastFetchTime?.getTime() ?? 0;
  const alertQueue = ackedLoaded
    ? orders
        .filter(
          (o) =>
            o.status !== "DELIVERED" &&
            !ackedIds[o.id] &&
            nowMs - new Date(o.createdAt).getTime() < 6 * 60 * 60 * 1000
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((o) => o.id)
    : [];
  const alertKey = alertQueue.join(",");

  useEffect(() => {
    if (alertQueue.length === 0) {
      stopAlertLoop();
      return;
    }
    const fresh = alertQueue.filter((id) => !alertedRef.current.has(id));
    if (fresh.length > 0) {
      fresh.forEach((id) => alertedRef.current.add(id));
      // Close other dialogs so the alert's button can always be tapped.
      setExpandedOrderId(null);
      setDeleteDialogOpen(false);
      playNotificationSound();
      fresh.forEach((id) => {
        const o = orders.find((x) => x.id === id);
        if (o) showBrowserNotification(o);
      });
    }
    startAlertLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey]);

  // Check right away when the page comes back (phone unlocked, tab
  // reopened) instead of waiting for the next 5-second refresh.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchOrdersQuietly();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isJaeky = brand.site === "jaeky";
  const accent = isJaeky
    ? {
        chip: "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
        ticket: "bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/30",
        button: "bg-purple-700 text-white hover:bg-purple-800",
        outline: "border-purple-200 bg-purple-50/60 text-purple-800 hover:bg-purple-100",
        tabActive: "data-[state=active]:bg-white data-[state=active]:text-purple-800 data-[state=active]:shadow-sm",
        ring: "focus-visible:ring-purple-500",
        pageGlow: "from-purple-100/70",
        alertButton: "bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white hover:from-purple-800 hover:to-fuchsia-700",
      }
    : {
        chip: "bg-lime-100 text-lime-900 ring-1 ring-lime-300",
        ticket: "bg-gradient-to-br from-lime-400 to-lime-700 text-white shadow-md shadow-lime-500/30",
        button: "bg-lime-700 text-white hover:bg-lime-800",
        outline: "border-lime-200 bg-lime-50/60 text-lime-900 hover:bg-lime-100",
        tabActive: "data-[state=active]:bg-white data-[state=active]:text-lime-900 data-[state=active]:shadow-sm",
        ring: "focus-visible:ring-lime-500",
        pageGlow: "from-lime-100/70",
        alertButton: "bg-gradient-to-r from-lime-500 to-lime-700 text-white hover:from-lime-600 hover:to-lime-800",
      };

  const statusChip = (isDelivered: boolean, large = false) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      } ${
        isDelivered
          ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
          : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isDelivered ? "bg-emerald-600" : "bg-amber-500"}`}
        aria-hidden="true"
      />
      {isDelivered ? "Ready" : "Pending"}
    </span>
  );

  const infoChip = (icon: React.ReactNode, label: string, large = false) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white font-medium text-zinc-700 ring-1 ring-zinc-200 ${
        large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {icon}
      {label}
    </span>
  );

  const paymentChip = (order: Order, large = false) =>
    infoChip(
      order.paymentType === "CARD" ? (
        <CreditCard className={large ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
      ) : (
        <Banknote className={large ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
      ),
      order.paymentType === "CARD" ? "Card" : "Cash",
      large
    );

  // No prices anywhere on this page: staff don't need to see them.
  const renderOrderCard = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isNew = alertQueue.includes(order.id);
    const itemCount = getTotalItems(order.items);
    const thumbs = order.items
      .map((item) => (item.product?.id ? productImages[item.product.id] : undefined))
      .filter((src): src is string => Boolean(src))
      .slice(0, 3);

    const openOrder = () => {
      ackOrder(order.id);
      setExpandedOrderId(order.id);
    };

    return (
      <div
        key={order.id}
        role="button"
        tabIndex={0}
        onClick={openOrder}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openOrder();
          }
        }}
        className={`group relative flex cursor-pointer flex-col gap-3.5 rounded-3xl border bg-white/90 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_16px_32px_-12px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99] ${accent.ring} ${
          isNew ? "border-red-400 ring-2 ring-red-400/60" : isDelivered ? "border-zinc-200/80" : "border-amber-400"
        }`}
        // Not ready yet = keeps flashing (red for not accepted, amber once
        // accepted) until someone marks it Ready.
        style={
          isDelivered
            ? undefined
            : { animation: `${isNew ? "order-card-flash-new" : "order-card-flash"} 1.4s ease-in-out infinite` }
        }
      >
        {isNew && (
          <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white shadow">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" aria-hidden="true" />
            NEW
          </span>
        )}

        {/* Ticket number, who, when */}
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 min-w-12 shrink-0 flex-col items-center justify-center rounded-2xl px-2 leading-none ${accent.ticket}`}
          >
            <span className="text-[9px] font-semibold tracking-widest uppercase opacity-80">No.</span>
            <span className="text-lg font-extrabold tabular-nums">{order.orderNumber ?? "—"}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg leading-tight font-bold tracking-tight text-zinc-900">
              {order.customerName || "Guest"}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDate(order.createdAt)}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Delete order for ${order.customerName || "Guest"}`}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(order);
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Status, payment, seat */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusChip(isDelivered)}
          {paymentChip(order)}
          {order.Seating && infoChip(<MapPin className="h-3.5 w-3.5" aria-hidden="true" />, order.Seating)}
        </div>

        {/* What they ordered (no prices) */}
        <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
          <div className="flex items-center gap-3">
            {thumbs.length > 0 ? (
              <div className="flex shrink-0 -space-x-3">
                {thumbs.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-11 w-11 rounded-xl object-cover ring-2 ring-white"
                  />
                ))}
              </div>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                <Package className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <ul className="min-w-0 flex-1 space-y-0.5">
              {order.items.slice(0, 2).map((item) => (
                <li key={item.id} className="truncate text-sm text-zinc-800">
                  <span className="font-bold tabular-nums">{item.quantity}×</span>{" "}
                  {item.product?.name ?? "Item no longer available"}
                </li>
              ))}
              {order.items.length > 2 && (
                <li className="text-xs font-medium text-zinc-500">+{order.items.length - 2} more</li>
              )}
            </ul>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 tabular-nums">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <span
          className={`mt-auto flex h-11 items-center justify-center rounded-2xl text-sm font-semibold transition-colors ${
            isDelivered ? `border ${accent.outline}` : accent.button
          }`}
        >
          View order
        </span>
      </div>
    );
  };

  // Full detail view for whichever order was tapped (no prices).
  const renderExpandedOrderDetails = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const itemCount = getTotalItems(order.items);

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {statusChip(isDelivered, true)}
          {paymentChip(order, true)}
          {order.Seating && infoChip(<MapPin className="h-4 w-4" aria-hidden="true" />, order.Seating, true)}
        </div>

        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {order.items.map((item) => {
            // A product can be deleted from the menu after an order was
            // placed for it, so `item.product` can be null. Guard every access.
            const productId = item.product?.id;
            const productName = item.product?.name ?? "Item no longer available";

            return (
              <div key={item.id} className="flex items-center gap-3 p-3">
                {productId && productImages[productId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImages[productId]}
                    alt={productName}
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                    <Package className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <p className="min-w-0 flex-1 truncate text-base font-semibold text-zinc-900">{productName}</p>
                <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 px-2 text-lg font-extrabold text-zinc-900 tabular-nums">
                  ×{item.quantity}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between bg-zinc-50 p-3">
            <span className="text-sm font-medium text-zinc-600">Total items</span>
            <span className="text-lg font-bold text-zinc-900 tabular-nums">{itemCount}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            // Update the status, then close this popup so staff land back
            // on the All Orders board with the fresh list.
            await handleStatusToggle(order);
            setExpandedOrderId(null);
          }}
          disabled={updatingStatus === order.id}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition-colors disabled:opacity-60 ${
            isDelivered
              ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
              : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
          }`}
        >
          {updatingStatus === order.id ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Updating
            </>
          ) : isDelivered ? (
            "Move back to Pending"
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Mark Ready
            </>
          )}
        </button>
      </div>
    );
  };

  // Tonight's sales (admins only). A night runs 6 AM to 6 AM so a late
  // shift isn't split at midnight; pending and ready both count.
  const money = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  // Same numbers as the downloadable night report.
  const todaysSales = buildNightReport(ordersSinceMidnight(orders));
  const startOfToday = todaysSales.date;
  // Double-click (computer) or double-tap (phone) on Total.
  const handleTotalTap = () => {
    if (!isAdmin) return;
    const now = Date.now();
    if (now - lastTotalTapRef.current < 400) {
      lastTotalTapRef.current = 0;
      setSalesOpen(true);
    } else {
      lastTotalTapRef.current = now;
    }
  };

  // The order shown in the flashing new-order pop-up (oldest waiting first).
  const alertOrder = alertQueue.length > 0 ? orders.find((o) => o.id === alertQueue[0]) ?? null : null;
  // Accepts the order shown in the pop-up. If more are waiting, the next one
  // pops up right away; after the last one, its details open.
  const viewAlertOrder = () => {
    const id = alertQueue[0];
    if (!id) return;
    ackOrder(id);
    if (alertQueue.length <= 1) setExpandedOrderId(id);
  };

  const emptyState = (icon: React.ReactNode, title: string, subtitle: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200">
        {icon}
      </span>
      <p className="text-base font-semibold text-zinc-800">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
    </div>
  );

  if (!mounted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-50">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className={`flex h-dvh flex-col bg-gradient-to-b ${accent.pageGlow} via-zinc-50 to-zinc-50`}>
      {/* Flashing keyframes for the new-order pop-up */}
      <style>{`
        @keyframes order-alert-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55), 0 25px 50px -12px rgba(0,0,0,0.35); border-color: rgb(220 38 38); }
          50% { box-shadow: 0 0 0 18px rgba(220, 38, 38, 0), 0 25px 50px -12px rgba(0,0,0,0.35); border-color: rgb(254 202 202); }
        }
        @keyframes order-alert-backdrop {
          0%, 100% { background-color: rgba(127, 29, 29, 0.55); }
          50% { background-color: rgba(24, 24, 27, 0.55); }
        }
        @keyframes order-card-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55), 0 8px 24px -12px rgba(0,0,0,0.12); }
          50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.12), 0 8px 24px -12px rgba(0,0,0,0.12); }
        }
        @keyframes order-card-flash-new {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6), 0 8px 24px -12px rgba(0,0,0,0.12); }
          50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.15), 0 8px 24px -12px rgba(0,0,0,0.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="order-card-flash"] { animation-duration: 3s !important; }
        }
        @keyframes order-alert-bell {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-16deg); }
          40% { transform: rotate(14deg); }
          60% { transform: rotate(-10deg); }
          80% { transform: rotate(6deg); }
        }
      `}</style>

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-2 px-4 md:gap-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <SidebarTrigger className="-ml-1 hidden text-zinc-500 hover:text-zinc-900 sm:flex" />
            <Separator orientation="vertical" className="hidden h-4 bg-zinc-200 sm:block" />
            <Breadcrumb className="hidden min-w-0 sm:block">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
                    Order Tracking
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden text-zinc-300 md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate text-sm font-medium text-zinc-900">All Orders</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 sm:hidden">Orders</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {alertQueue.length > 0 ? (
                <span className="font-semibold text-red-600">New order!</span>
              ) : (
                <>
                  <span className="hidden sm:inline">
                    Live{shiftOn ? " · sound on" : ""}
                    {shiftOn && screenAwake ? " · screen awake" : ""} · updated {getTimeSinceLastFetch()}
                  </span>
                  <span className="sm:hidden">{shiftOn ? "Live · sound on" : "Live"}</span>
                </>
              )}
            </div>
            <Link
              href="/all-orders-enlarged"
              className={`hidden h-9 items-center rounded-xl px-3 text-sm font-semibold transition-colors sm:inline-flex ${accent.button}`}
            >
              Enlarge
            </Link>
          </div>
        </div>
      </header>

      {/* Start shift: one tap turns on the new-order sound and keeps the
          screen awake. Shown until it's been tapped. */}
      {!shiftOn && (
        <div className="shrink-0 px-4 pt-3 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 sm:p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-900 sm:text-base">Start your shift</p>
              <p className="text-xs text-zinc-600 sm:text-sm">Turns on the new-order sound and keeps this screen awake.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await startShift(unlockSound);
                playNotificationSound(); // so staff hear that sound works
              }}
              className={`h-11 shrink-0 rounded-xl px-4 text-sm font-bold shadow-sm transition-colors sm:px-5 sm:text-base ${accent.button}`}
            >
              Start shift
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500">Loading orders</p>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <AlertCircle className="mb-3 h-10 w-10 text-red-600" />
            <div className="mb-1 text-sm font-medium text-red-700">Error loading orders</div>
            <p className="mb-4 text-xs text-zinc-500">{error}</p>
            <Button onClick={fetchOrders} variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50">
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          emptyState(<ShoppingBag className="h-8 w-8" />, "No orders yet", "New orders show up here automatically.")
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
            {/* Counts + Pending / Ready switch */}
            <div className="shrink-0 px-4 pt-4 pb-2 md:px-6">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:flex">
                  {[
                    { label: "Total", value: orders.length, box: "bg-white ring-zinc-200", tone: "text-zinc-900" },
                    { label: "Pending", value: pendingOrders.length, box: "bg-amber-50 ring-amber-200", tone: "text-amber-700" },
                    { label: "Ready", value: deliveredOrders.length, box: "bg-emerald-50 ring-emerald-200", tone: "text-emerald-700" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      onClick={stat.label === "Total" ? handleTotalTap : undefined}
                      className={`rounded-2xl px-3 py-2.5 ring-1 select-none lg:min-w-32 ${stat.box} ${
                        stat.label === "Total" && isAdmin ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{stat.label}</div>
                      <div className={`text-2xl leading-tight font-extrabold tabular-nums ${stat.tone}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>
                <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-zinc-200/70 p-1 lg:w-80">
                  <TabsTrigger value="pending" className={`h-10 rounded-xl text-sm font-semibold text-zinc-600 ${accent.tabActive}`}>
                    Pending · {pendingOrders.length}
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className={`h-10 rounded-xl text-sm font-semibold text-zinc-600 ${accent.tabActive}`}>
                    Ready · {deliveredOrders.length}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <TabsContent value="pending" className="m-0 h-full">
                <ScrollArea className="h-full">
                  <div className="mx-auto max-w-7xl px-4 pt-3 pb-28 md:px-6 md:pb-8">
                    {pendingOrders.length === 0 ? (
                      emptyState(<Clock className="h-8 w-8" />, "No pending orders", "Everything is ready.")
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {pendingOrders.map((order) => renderOrderCard(order))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="delivered" className="m-0 h-full">
                <ScrollArea className="h-full">
                  <div className="mx-auto max-w-7xl px-4 pt-3 pb-28 md:px-6 md:pb-8">
                    {deliveredOrders.length === 0 ? (
                      emptyState(<CheckCircle2 className="h-8 w-8" />, "No ready orders", "Orders show up here once they're marked ready.")
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {deliveredOrders.map((order) => renderOrderCard(order))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>

      {/* NEW ORDER pop-up: flashes with a repeating tone until staff tap
          "View order". It can't be closed any other way. */}
      {alertQueue.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-3 backdrop-blur-sm sm:items-center sm:p-6"
          style={{ animation: "order-alert-backdrop 1s ease-in-out infinite" }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="new-order-title"
            className="w-full max-w-md rounded-[28px] border-4 bg-white p-5 sm:p-6"
            style={{ animation: "order-alert-flash 1s ease-in-out infinite" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/40"
                style={{ animation: "order-alert-bell 1s ease-in-out infinite" }}
              >
                <Bell className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-widest text-red-600 uppercase">New order</p>
                <h2 id="new-order-title" className="truncate text-2xl leading-tight font-extrabold tracking-tight text-zinc-900">
                  {alertOrder ? (
                    <>
                      {alertOrder.orderNumber != null && (
                        <span className="text-zinc-400">#{alertOrder.orderNumber} </span>
                      )}
                      {alertOrder.customerName || "Guest"}
                    </>
                  ) : (
                    "Incoming…"
                  )}
                </h2>
              </div>
            </div>

            {alertOrder && (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {alertOrder.Seating &&
                    infoChip(<MapPin className="h-4 w-4" aria-hidden="true" />, alertOrder.Seating, true)}
                  {paymentChip(alertOrder, true)}
                </div>
                <ul className="mt-4 space-y-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
                  {alertOrder.items.slice(0, 4).map((item) => {
                    const src = item.product?.id ? productImages[item.product.id] : undefined;
                    return (
                      <li key={item.id} className="flex items-center gap-3">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-500">
                            <Package className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-base font-semibold text-zinc-900">
                          {item.product?.name ?? "Item no longer available"}
                        </span>
                        <span className="text-lg font-extrabold text-zinc-900 tabular-nums">×{item.quantity}</span>
                      </li>
                    );
                  })}
                  {alertOrder.items.length > 4 && (
                    <li className="text-sm font-medium text-zinc-500">+{alertOrder.items.length - 4} more</li>
                  )}
                </ul>
              </>
            )}

            {alertQueue.length > 1 && (
              <p className="mt-3 text-center text-sm font-semibold text-red-700">
                +{alertQueue.length - 1} more new order{alertQueue.length - 1 === 1 ? "" : "s"} waiting
              </p>
            )}

            <button
              type="button"
              autoFocus
              onClick={viewAlertOrder}
              className={`mt-5 flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300 ${accent.alertButton}`}
            >
              View order
            </button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-3xl border-zinc-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-900">Delete order</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-600">
              Are you sure you want to delete the order for{" "}
              <span className="font-semibold text-zinc-900">{orderToDelete?.customerName}</span>? This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={deleting} className="mt-0 border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="mt-0 bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Today's sales — admins only, opened by double-tapping Total */}
      {isAdmin && (
        <Dialog open={salesOpen} onOpenChange={setSalesOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl border-zinc-200 bg-white">
            <DialogHeader>
              <DialogTitle className="text-left text-zinc-900">
                <span className="block text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Tonight&apos;s sales ·{" "}
                  {startOfToday.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
                <span className="mt-1 block text-4xl font-extrabold tracking-tight tabular-nums">
                  {money(todaysSales.total)}
                </span>
                <span className="mt-1 block text-sm font-normal text-zinc-500">
                  {todaysSales.count} order{todaysSales.count === 1 ? "" : "s"} · {todaysSales.items} item
                  {todaysSales.items === 1 ? "" : "s"}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Cash", value: todaysSales.cash, box: "bg-zinc-50 ring-zinc-200" },
                { label: "Card", value: todaysSales.card, box: "bg-zinc-50 ring-zinc-200" },
                { label: "Ready", value: todaysSales.ready, box: "bg-emerald-50 ring-emerald-200" },
                { label: "Still pending", value: todaysSales.pending, box: "bg-amber-50 ring-amber-200" },
              ].map((row) => (
                <div key={row.label} className={`rounded-2xl px-3 py-2.5 ring-1 ${row.box}`}>
                  <div className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{row.label}</div>
                  <div className="text-lg font-bold text-zinc-900 tabular-nums">{money(row.value)}</div>
                </div>
              ))}
            </div>
            {todaysSales.topItems.length > 0 && (
              <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                <div className="mb-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Top items</div>
                <ul className="space-y-1.5">
                  {todaysSales.topItems.slice(0, 5).map((t, i) => (
                    <li key={t.name} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-xs font-bold text-zinc-400 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{t.name}</span>
                      <span className="text-zinc-500 tabular-nums">×{t.quantity}</span>
                      <span className="w-20 text-right font-semibold text-zinc-900 tabular-nums">{money(t.sales)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => downloadNightReport(todaysSales, brand.name)}
              disabled={todaysSales.count === 0}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition-colors disabled:opacity-40 ${accent.button}`}
            >
              Download tonight&apos;s report
            </button>
            <p className="text-xs text-zinc-500">
              Only admins can see this. Staff never see prices. Download the report before wash-up: wash-up clears
              tonight&apos;s orders.
            </p>
          </DialogContent>
        </Dialog>
      )}

      {/* Order details, opened by tapping a card in the grid */}
      <Dialog
        open={expandedOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setExpandedOrderId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-3xl border-zinc-200 bg-zinc-50">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-left text-xl text-zinc-900">
              {expandedOrder?.orderNumber != null && (
                <span className={`rounded-xl px-2.5 py-1 text-base font-bold tabular-nums ${accent.ticket}`}>
                  #{expandedOrder.orderNumber}
                </span>
              )}
              <span className="font-extrabold tracking-tight">{expandedOrder?.customerName || "Guest"}</span>
              {expandedOrder && (
                <span className="text-sm font-normal text-zinc-500">{formatDate(expandedOrder.createdAt)}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {expandedOrder && renderExpandedOrderDetails(expandedOrder)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
