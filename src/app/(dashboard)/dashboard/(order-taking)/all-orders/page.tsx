"use client";
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  ShoppingBag,
  Clock,
  User,
  Package,
  DollarSign,
  Calendar,
  CreditCard,
  Banknote,
  MapPin,
  Trash2,
  Bell,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Bigger, easy-to-read tile for the grid. Marking an order ready only
  // happens from the full detail popup now — this card's button just
  // opens that popup ("View Order"), so staff can't accidentally toggle
  // status with a stray tap on the grid.
  const renderOrderCard = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isVIP = order.Seating?.toUpperCase().includes("VIP");

    const openOrder = () => {
      acknowledgeNewOrders();
      setExpandedOrderId(order.id);
    };

    return (
      <Card
        key={order.id}
        onClick={openOrder}
        className={`group bg-black border hover:border-primary/50 transition-all duration-200 cursor-pointer gap-2 py-4 ${
          unacknowledgedOrderIds.has(order.id)
            ? "animate-pulse border-red-500 ring-2 ring-red-500/50"
            : "border-border"
        }`}
      >
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {order.orderNumber != null && (
                  <Badge
                    variant="outline"
                    className="text-sm font-bold border-lime-500/50 bg-lime-500/10 text-lime-400 tabular-nums px-2 py-0.5 shrink-0"
                  >
                    #{order.orderNumber}
                  </Badge>
                )}
                <h3 className="font-bold text-lg text-white truncate">
                  {order.customerName || "Guest"}
                </h3>
                {isVIP && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0 border-amber-300 dark:border-amber-800 shrink-0">
                    VIP
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(order.createdAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(order);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <Badge
            variant="outline"
            className={`self-start text-sm font-bold px-3 py-1 ${
              isDelivered
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
            }`}
          >
            {isDelivered ? "READY" : "PENDING"}
          </Badge>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-sm border-border bg-muted text-foreground px-2.5 py-1"
            >
              {getTotalItems(order.items)} items
            </Badge>
            <Badge
              variant="outline"
              className={`text-sm font-bold px-2.5 py-1 ${
                order.paymentType === "CARD"
                  ? "bg-muted text-foreground"
                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
              }`}
            >
              {order.paymentType === "CARD" ? (
                <CreditCard className="w-3.5 h-3.5 mr-1" />
              ) : (
                <Banknote className="w-3.5 h-3.5 mr-1" />
              )}
              {order.paymentType === "CARD" ? "Card" : "Cash"}
            </Badge>
            {order.Seating && (
              <Badge
                variant="outline"
                className="text-sm border-border bg-muted text-muted-foreground px-2.5 py-1"
              >
                <MapPin className="w-3.5 h-3.5 mr-1" />
                {order.Seating}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 flex items-center justify-between gap-3">
          <span className="text-xl font-bold text-white">
            ${order.subtotal.toFixed(2)}
          </span>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              openOrder();
            }}
            size="sm"
            variant="outline"
            className="border-primary/50 text-foreground hover:bg-primary/10"
          >
            View Order
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Full detail view for whichever order was tapped in the grid — the
  // in-depth layout (item images, prices, big total) the compact cards
  // above no longer show all the time.
  const renderExpandedOrderDetails = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isVIP = order.Seating?.toUpperCase().includes("VIP");

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {order.orderNumber != null && (
            <Badge
              variant="outline"
              className="text-xs font-bold border-lime-500/50 bg-lime-500/10 text-lime-400 tabular-nums px-1.5 py-0"
            >
              #{order.orderNumber}
            </Badge>
          )}
          {isVIP && (
            <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0 border-amber-300 dark:border-amber-800">
              VIP
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-xs font-medium ${
              isDelivered
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
            }`}
          >
            {isDelivered ? "READY" : "PENDING"}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground -mt-2">
          {formatDate(order.createdAt)}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-xs border-border bg-muted text-foreground"
          >
            {getTotalItems(order.items)} items
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs uppercase font-bold border-border px-2 py-1 ${
              order.paymentType === "CARD"
                ? "bg-muted text-foreground"
                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
            }`}
          >
            {order.paymentType === "CARD" ? (
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Banknote className="w-3.5 h-3.5 mr-1.5" />
            )}
            {order.paymentType === "CARD" ? "Card" : "Cash"}
          </Badge>
          {order.Seating && (
            <Badge
              variant="outline"
              className="text-xs border-border bg-muted text-muted-foreground"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {order.Seating}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {order.items.map((item) => {
            // A product can be deleted from the menu after an order was
            // placed for it. When that happens, `item.product` comes back
            // as null even though the TypeScript type claims it's always
            // present. Guard every access so one deleted menu item can't
            // crash this view.
            const productId = item.product?.id;
            const productName = item.product?.name ?? "Item no longer available";
            const productPrice = item.product?.price ?? 0;

            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 p-2.5 bg-muted border border-border rounded"
              >
                {productId && productImages[productId] ? (
                  <img
                    src={productImages[productId]}
                    alt={productName}
                    className="w-10 h-10 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {productName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${productPrice.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    ${(productPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">
              Total
            </span>
            <span className="text-xl font-bold text-foreground">
              ${order.subtotal.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={async () => {
                // Update the status, then close this popup so staff land
                // back on the All Orders board with the fresh list.
                await handleStatusToggle(order);
                setExpandedOrderId(null);
              }}
              disabled={updatingStatus === order.id}
              className={`flex-1 font-medium transition-all ${
                isDelivered
                  ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 text-white"
              }`}
            >
              {updatingStatus === order.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating
                </>
              ) : isDelivered ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Ready
                </>
              ) : (
                "Mark Ready"
              )}
            </Button>
            <Button
              variant="outline"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                setExpandedOrderId(null);
                handleDeleteClick(order);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-neutral-100">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-100">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-card border-b border-border">
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 w-full justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <SidebarTrigger className="hidden sm:flex -ml-1 text-muted-foreground hover:text-foreground" />
            <Separator
              orientation="vertical"
              className="h-4 bg-border hidden sm:block"
            />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    Order Tracking
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block text-muted-foreground" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-foreground text-sm font-medium truncate">
                    All Orders
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Clock className="w-3.5 h-3.5 hidden sm:block" />
              <span className="hidden sm:inline">
                Updated {getTimeSinceLastFetch()}
              </span>
              <span className="sm:hidden">{getTimeSinceLastFetch()}</span>
            </div>
            <Link href="/all-orders-enlarged">
              <Button>Enlarge</Button>
            </Link>
          </div>
        </div>
      </header>

      {hasUnacknowledgedOrder && (
        <button
          onClick={acknowledgeNewOrders}
          className="flex w-full items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm md:text-base font-semibold py-3 px-4 animate-pulse transition-colors shrink-0"
        >
          <Bell className="w-5 h-5" />
          New order received — tap to acknowledge
        </button>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground text-sm">Loading orders</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <div className="text-destructive text-sm font-medium mb-1">
              Error loading orders
            </div>
            <p className="text-muted-foreground text-xs mb-4">{error}</p>
            <Button
              onClick={fetchOrders}
              variant="outline"
              className="bg-card border-border hover:bg-accent text-foreground"
            >
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <p className="text-gray-700 text-sm font-medium">No orders</p>
            <p className="text-muted-foreground text-xs mt-1">
              Waiting for new orders...
            </p>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-row"
          >
            {/* Compact side column: stats stacked vertically + tabs.
                Slides away to w-0 when collapsed, leaving just the thin
                toggle strip so it can be reopened. */}
            <div
              className={`shrink-0 border-r border-border bg-card overflow-hidden transition-all duration-300 ${
                sidebarCollapsed ? "w-0" : "w-28 sm:w-32 md:w-36"
              }`}
            >
              <div className="w-28 sm:w-32 md:w-36 h-full overflow-y-auto p-2 flex flex-col gap-1.5">
                <div className="bg-muted border border-border rounded-md px-2 py-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Total
                  </div>
                  <div className="text-base font-bold text-foreground">
                    {orders.length}
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-md px-2 py-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Pending
                  </div>
                  <div className="text-base font-bold text-amber-500 dark:text-amber-400">
                    {pendingOrders.length}
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-md px-2 py-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Ready
                  </div>
                  <div className="text-base font-bold text-emerald-500 dark:text-emerald-400">
                    {deliveredOrders.length}
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-md px-2 py-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                    Sales
                  </div>
                  <div className="text-sm font-bold text-blue-500 dark:text-blue-400">
                    $
                    {deliveredOrders
                      .reduce((sum, order) => sum + order.subtotal, 0)
                      .toFixed(2)}
                  </div>
                </div>

                <TabsList className="flex flex-col h-auto w-full bg-muted border border-border gap-1 p-1 mt-1">
                  <TabsTrigger
                    value="pending"
                    className="w-full justify-start text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white"
                  >
                    Pending ({pendingOrders.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="delivered"
                    className="w-full justify-start text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                  >
                    Ready ({deliveredOrders.length})
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Thin always-visible strip to slide the side column open/closed */}
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? "Show stats" : "Hide stats"}
              className="shrink-0 w-4 sm:w-5 h-full flex items-center justify-center bg-card border-r border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="pending" className="h-full m-0">
                <ScrollArea className="h-full">
                  <div className="px-3 md:px-6 py-3 md:py-6">
                    {pendingOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <Clock className="w-16 h-16 text-muted-foreground/50 mb-4" />
                        <p className="text-gray-700 text-sm font-medium">
                          No pending orders
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          All orders are ready
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        {pendingOrders.map((order) => renderOrderCard(order))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="delivered" className="h-full m-0">
                <ScrollArea className="h-full">
                  <div className="px-3 md:px-6 py-3 md:py-6">
                    {deliveredOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <CheckCircle2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
                        <p className="text-gray-700 text-sm font-medium">
                          No ready orders
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Orders will appear here once ready
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
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
        <AlertDialogContent className="bg-card border-border w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete Order
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete the order for{" "}
              <span className="font-semibold text-foreground">
                {orderToDelete?.customerName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              disabled={deleting}
              className="bg-muted border-border hover:bg-accent text-foreground mt-0"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground mt-0"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order details, opened by tapping a compact card in the grid */}
      <Dialog
        open={expandedOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setExpandedOrderId(null);
        }}
      >
        <DialogContent className="bg-card border-border w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {expandedOrder?.customerName || "Guest"}
            </DialogTitle>
          </DialogHeader>
          {expandedOrder && renderExpandedOrderDetails(expandedOrder)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
