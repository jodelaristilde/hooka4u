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
  const [hasUnacknowledgedOrder, setHasUnacknowledgedOrder] = useState(false);
  const [unacknowledgedOrderIds, setUnacknowledgedOrderIds] = useState<
    Set<string>
  >(new Set());
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const alertLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUnlockedRef = useRef(false);

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

  const handleNewOrder = (newOrder: Order) => {
    startAlertLoop();

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🔔 New Order Received!", {
        body: `Order from ${
          newOrder.customerName || "Guest"
        } - $${newOrder.subtotal.toFixed(2)}`,
        icon: "/notification-icon.png",
        badge: "/badge-icon.png",
        tag: newOrder.id,
      });
    }

    // Keep this order visually flagged (pulsing, red border) until a
    // staff member taps its card to acknowledge it — not just for a few
    // seconds, since the sound keeps playing until then too.
    setUnacknowledgedOrderIds((prev) => new Set(prev).add(newOrder.id));
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
    }
  };

  // Keep playing the notification sound every few seconds until a staff
  // member taps anywhere on an order card (or the banner) to acknowledge
  // it, instead of just chiming once and possibly going unnoticed.
  const startAlertLoop = () => {
    setHasUnacknowledgedOrder(true);
    playNotificationSound();

    if (alertLoopRef.current) return; // already looping

    alertLoopRef.current = setInterval(() => {
      playNotificationSound();
    }, 2500);
  };

  const acknowledgeNewOrders = () => {
    if (alertLoopRef.current) {
      clearInterval(alertLoopRef.current);
      alertLoopRef.current = null;
    }
    setHasUnacknowledgedOrder(false);
    setUnacknowledgedOrderIds(new Set());
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
      const newOrders = fetchedOrders.filter(
        (order: Order) => !previousOrderIdsRef.current.has(order.id)
      );

      if (newOrders.length > 0) {
        newOrders.forEach((order: Order) => handleNewOrder(order));
      }

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

  const isJaeky = brand.site === "jaeky";
  const accent = isJaeky
    ? {
        chip: "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
        button: "bg-purple-700 text-white hover:bg-purple-800",
        outline: "border-purple-300 text-purple-800 hover:bg-purple-50",
        tabActive: "data-[state=active]:bg-purple-700 data-[state=active]:text-white",
        ring: "focus-visible:ring-purple-500",
      }
    : {
        chip: "bg-lime-100 text-lime-900 ring-1 ring-lime-300",
        button: "bg-lime-700 text-white hover:bg-lime-800",
        outline: "border-lime-300 text-lime-900 hover:bg-lime-50",
        tabActive: "data-[state=active]:bg-lime-700 data-[state=active]:text-white",
        ring: "focus-visible:ring-lime-500",
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
      className={`inline-flex items-center gap-1.5 rounded-full bg-zinc-100 font-medium text-zinc-700 ring-1 ring-zinc-200 ${
        large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {icon}
      {label}
    </span>
  );

  // Light, easy-to-scan tile for the grid: who, when, status, what they
  // ordered (thumbnails + count + total). Marking an order ready still only
  // happens from the full detail popup, so a stray tap on the grid can't
  // change an order's status.
  const renderOrderCard = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isVIP = order.Seating?.toUpperCase().includes("VIP");
    const isNew = unacknowledgedOrderIds.has(order.id);
    const itemCount = getTotalItems(order.items);
    const thumbs = order.items
      .map((item) => (item.product?.id ? productImages[item.product.id] : undefined))
      .filter((src): src is string => Boolean(src))
      .slice(0, 4);
    const itemNames = order.items
      .map((item) => `${item.quantity}× ${item.product?.name ?? "Item"}`)
      .join(", ");

    const openOrder = () => {
      acknowledgeNewOrders();
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
        className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 ${accent.ring} ${
          isNew ? "border-red-400 ring-2 ring-red-400/60" : "border-zinc-200"
        }`}
      >
        {isNew && (
          <span className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white shadow">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" aria-hidden="true" />
            NEW
          </span>
        )}

        {/* Who and when */}
        <div className="flex items-start gap-3">
          {order.orderNumber != null && (
            <span className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold tabular-nums ${accent.chip}`}>
              #{order.orderNumber}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg leading-tight font-bold text-zinc-900">
              {order.customerName || "Guest"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">{formatDate(order.createdAt)}</p>
          </div>
          <button
            type="button"
            aria-label={`Delete order for ${order.customerName || "Guest"}`}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(order);
            }}
            className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Status, payment, seat */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusChip(isDelivered)}
          {infoChip(
            order.paymentType === "CARD" ? (
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
            ),
            order.paymentType === "CARD" ? "Card" : "Cash"
          )}
          {order.Seating && infoChip(<MapPin className="h-3.5 w-3.5" aria-hidden="true" />, order.Seating)}
          {isVIP && (
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-950">VIP</span>
          )}
        </div>

        {/* What they ordered */}
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-100">
          {thumbs.length > 0 ? (
            <div className="flex shrink-0 -space-x-2">
              {thumbs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover ring-2 ring-white"
                />
              ))}
            </div>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-500">
              <Package className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">{itemNames || "No items"}</p>
            <p className="text-xs text-zinc-500">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </p>
          </div>
          <span className="shrink-0 text-base font-bold text-zinc-900 tabular-nums">
            ${order.subtotal.toFixed(2)}
          </span>
        </div>

        <span
          className={`mt-auto flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${accent.outline}`}
        >
          View order
        </span>
      </div>
    );
  };

  // Full detail view for whichever order was tapped in the grid.
  const renderExpandedOrderDetails = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isVIP = order.Seating?.toUpperCase().includes("VIP");

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {statusChip(isDelivered, true)}
          {infoChip(
            order.paymentType === "CARD" ? (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Banknote className="h-4 w-4" aria-hidden="true" />
            ),
            order.paymentType === "CARD" ? "Card" : "Cash",
            true
          )}
          {order.Seating && infoChip(<MapPin className="h-4 w-4" aria-hidden="true" />, order.Seating, true)}
          {isVIP && (
            <span className="rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-amber-950">VIP</span>
          )}
        </div>

        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {order.items.map((item) => {
            // A product can be deleted from the menu after an order was
            // placed for it, so `item.product` can be null. Guard every access.
            const productId = item.product?.id;
            const productName = item.product?.name ?? "Item no longer available";
            const price = item.product?.price;

            return (
              <div key={item.id} className="flex items-center gap-3 p-3">
                {productId && productImages[productId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImages[productId]}
                    alt={productName}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">
                    <Package className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-zinc-900">{productName}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {item.quantity} × {price != null ? `$${price.toFixed(2)}` : "—"}
                  </p>
                </div>
                {price != null && (
                  <span className="shrink-0 text-base font-semibold text-zinc-900 tabular-nums">
                    ${(price * item.quantity).toFixed(2)}
                  </span>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between bg-zinc-50 p-3">
            <span className="text-sm font-medium text-zinc-600">
              Total · {getTotalItems(order.items)} item{getTotalItems(order.items) === 1 ? "" : "s"}
            </span>
            <span className="text-xl font-bold text-zinc-900 tabular-nums">${order.subtotal.toFixed(2)}</span>
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
              : "bg-emerald-600 text-white hover:bg-emerald-700"
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

  const salesTotal = deliveredOrders.reduce((sum, order) => sum + order.subtotal, 0);

  const emptyState = (icon: React.ReactNode, title: string, subtitle: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200">
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
    <div className="flex h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white">
        <div className="flex w-full items-center justify-between gap-2 px-3 md:gap-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <SidebarTrigger className="-ml-1 hidden text-zinc-500 hover:text-zinc-900 sm:flex" />
            <Separator orientation="vertical" className="hidden h-4 bg-zinc-200 sm:block" />
            <Breadcrumb className="min-w-0">
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
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Live · updated {getTimeSinceLastFetch()}</span>
              <span className="sm:hidden">{getTimeSinceLastFetch()}</span>
            </div>
            <Link
              href="/all-orders-enlarged"
              className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${accent.button}`}
            >
              Enlarge
            </Link>
          </div>
        </div>
      </header>

      {hasUnacknowledgedOrder && (
        <button
          onClick={acknowledgeNewOrders}
          className="flex w-full shrink-0 animate-pulse items-center justify-center gap-2 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 md:text-base"
        >
          <Bell className="h-5 w-5" />
          New order received — tap to acknowledge
        </button>
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
            {/* Stats + Pending / Ready switch, across the top */}
            <div className="shrink-0 border-b border-zinc-200 bg-white px-3 py-3 md:px-6">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:flex">
                  {[
                    { label: "Total", value: String(orders.length), tone: "text-zinc-900" },
                    { label: "Pending", value: String(pendingOrders.length), tone: "text-amber-700" },
                    { label: "Ready", value: String(deliveredOrders.length), tone: "text-emerald-700" },
                    { label: "Sales", value: `$${salesTotal.toFixed(2)}`, tone: "text-zinc-900" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex min-w-0 items-baseline justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-1.5 ring-1 ring-zinc-200 sm:block sm:py-2 lg:min-w-28">
                      <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{stat.label}</div>
                      <div className={`truncate text-lg font-bold tabular-nums ${stat.tone}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-zinc-100 p-1 lg:w-80">
                  <TabsTrigger value="pending" className={`h-9 rounded-lg text-sm font-semibold ${accent.tabActive}`}>
                    Pending ({pendingOrders.length})
                  </TabsTrigger>
                  <TabsTrigger value="delivered" className={`h-9 rounded-lg text-sm font-semibold ${accent.tabActive}`}>
                    Ready ({deliveredOrders.length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <TabsContent value="pending" className="m-0 h-full">
                <ScrollArea className="h-full">
                  <div className="mx-auto max-w-7xl px-3 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
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
                  <div className="mx-auto max-w-7xl px-3 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg border-zinc-200 bg-white">
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

      {/* Order details, opened by tapping a card in the grid */}
      <Dialog
        open={expandedOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setExpandedOrderId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto border-zinc-200 bg-zinc-50">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-xl text-zinc-900">
              {expandedOrder?.orderNumber != null && (
                <span className={`rounded-lg px-2.5 py-1 text-base font-bold tabular-nums ${accent.chip}`}>
                  #{expandedOrder.orderNumber}
                </span>
              )}
              <span>{expandedOrder?.customerName || "Guest"}</span>
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
