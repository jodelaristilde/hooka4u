"use client";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize,
  Minimize,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

export default function AllOrdersEnlarged() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newOrderAnimation, setNewOrderAnimation] = useState<string | null>(
    null
  );
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // This page is only ever meaningful once it's running in the browser (it
  // fetches its own data on mount). Render nothing but a simple loading
  // spinner until the very first moment we're confirmed to be running in
  // the browser, so the server-drawn version and the browser's first paint
  // can never disagree with each other and crash React's hydration step.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGWe77OVvSxMLT6Xl8Lhb"
    );

    fetchOrders();
    requestNotificationPermission();
    enterFullscreen();

    const pollInterval = setInterval(() => {
      fetchOrdersQuietly();
    }, 60000);

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const enterFullscreen = async () => {
    try {
      if (containerRef.current && !document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.error("Error entering fullscreen:", err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Error exiting fullscreen:", err);
    }
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  const handleNewOrder = (newOrder: Order) => {
    playNotificationSound();

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🔔 New Order Received!", {
        body: `Order from ${newOrder.customerName || "Guest"}`,
        icon: "/notification-icon.png",
        badge: "/badge-icon.png",
        tag: newOrder.id,
      });
    }

    setNewOrderAnimation(newOrder.id);
    setTimeout(() => setNewOrderAnimation(null), 3000);
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
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

  // Bigger, easy-to-read tile for the grid — matches the main dashboard's
  // All Orders board. No prices are shown on this screen since it's the
  // one meant to be visible around the venue. Tapping "View Order" opens
  // the full details below in a popup, and marking an order delivered only
  // happens from there.
  const renderOrderCard = (order: Order) => {
    const isDelivered = order.status === "DELIVERED";
    const isVIP = order.Seating?.toUpperCase().includes("VIP");

    const openOrder = () => setExpandedOrderId(order.id);

    return (
      <Card
        key={order.id}
        onClick={openOrder}
        className={`group bg-black border hover:border-primary/50 transition-all duration-200 cursor-pointer gap-2 py-4 w-full sm:w-80 ${
          newOrderAnimation === order.id
            ? "animate-[pulse_0.5s_ease-in-out_4] border-blue-500"
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
            {isDelivered ? "DELIVERED" : "PENDING"}
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

        <CardContent className="px-4 flex items-center justify-end gap-3">
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

  // Full detail popup for whichever order was tapped in the grid. No prices
  // are shown here either — this whole screen is meant to be visible
  // around the venue.
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
            {isDelivered ? "DELIVERED" : "PENDING"}
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
            const productName =
              item.product?.name ?? "Item no longer available";

            return (
              <div
                key={item.id}
                className="flex items-center gap-2.5 p-2.5 bg-muted border border-border rounded"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {productName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    × {item.quantity}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                // Update the status, then close this popup so the board
                // shows the fresh list right away.
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
                  Delivered
                </>
              ) : (
                "Mark Delivered"
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
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-neutral-100 overflow-hidden"
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-card border-b border-border">
        <div className="flex flex-row md:gap-3 px-3 md:px-5 w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <Clock className="w-3.5 h-3.5 hidden sm:block" />
            <span className="hidden sm:inline">
              Updated {getTimeSinceLastFetch()}
            </span>
            <span className="sm:hidden">{getTimeSinceLastFetch()}</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </Button>
            <Link href="/dashboard/all-orders">
              <Button>
                Go back <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

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
                    Delivered
                  </div>
                  <div className="text-base font-bold text-emerald-500 dark:text-emerald-400">
                    {deliveredOrders.length}
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
                    Delivered ({deliveredOrders.length})
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
                          All orders have been delivered
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
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
                          No delivered orders
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Orders will appear here once delivered
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
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

      {/* Order details, opened by tapping "View Order" in the grid */}
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
