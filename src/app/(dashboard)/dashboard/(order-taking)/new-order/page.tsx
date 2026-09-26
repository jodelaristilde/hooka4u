"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, ShoppingCart, X, Loader2, ChevronUp, ArrowLeft } from 'lucide-react';
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmptyHookahState } from "@/components/empty-hookah-state";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
interface Product {
  id: string;
  name: string;
  image: string;
  price: number;
  description?: string;
  category?: string | null;
}

type CategoryTab = string;

const titleCase = (s: string) =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  [key: string]: CartItem;
}

export default function NewOrder() {
  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTab>("ALL");
  const [customerName, setCustomerName] = useState("");
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "">("");
  const [seating, setSeating] = useState("");
  const [cart, setCart] = useState<CartState>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  // <CHANGE> Added state for mobile sheet drawer
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [mobileSheetView, setMobileSheetView] = useState<"cart" | "form">("cart");
const [showSuccessDialog, setShowSuccessDialog] = useState(false);
const [lastOrderId, setLastOrderId] = useState<string>("");

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/menu-items");

        if (!response.ok) {
          throw new Error("Failed to fetch menu items");
        }

        const json = await response.json();
        const data: Product[] = Array.isArray(json) ? (json as Product[]) : [];
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load products"
        );
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        quantity: (prev[product.id]?.quantity || 0) + 1,
      },
    }));
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart((prev) => {
      const currentQty = prev[productId]?.quantity || 0;
      const newQty = currentQty + change;

      if (newQty <= 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: newQty,
        },
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const { [productId]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleProductClick = (product: Product) => {
    const inCart = cart[product.id];
    if (inCart && inCart.quantity === 1) {
      removeFromCart(product.id);
    } else {
      addToCart(product);
    }
  };

  const handlePlaceOrderClick = () => {
    if (cartItems.length === 0) return;
    setShowOrderForm(true);
  };

  // <CHANGE> Added handlers for mobile sheet
  const handleMobileOrderButton = () => {
    setIsMobileSheetOpen(true);
    setMobileSheetView("cart");
  };

  const handleMobileSheetPlaceOrder = () => {
    if (cartItems.length === 0) return;
    setMobileSheetView("form");
  };

  const handleMobileSheetBackToCart = () => {
    setMobileSheetView("cart");
  };

  const handleBackToCart = () => {
    setShowOrderForm(false);
  };
const handleConfirmOrder = async () => {
  if (!customerName.trim()) {
    toast.info("Customer name is required", {
      description: "Please enter a customer name before placing the order.",
      action: {
        label: "Close",
        onClick: () => console.log("Toast Closed"),
      },
    });
    return;
  }

  if (!paymentType) {
    toast.info("Payment type is required", {
      description: "Please select a payment type before placing the order.",
      action: {
        label: "Close",
        onClick: () => console.log("Toast Closed"),
      },
    });
    return;
  }

  if (!seating.trim()) {
    toast.info("Seating Location is required", {
      description: "Please enter a seating location before placing the order.",
      action: {
        label: "Close",
        onClick: () => console.log("Toast Closed"),
      },
    });
    return;
  }

  try {
    setSubmitting(true);
    const orderData = {
      customerName: customerName.trim(),
      paymentType,
      Seating: seating.trim() || null,
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      subtotal,
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error("Failed to place order");
    }

    const order = await response.json();

    // Store the short order number (fall back to the raw id if it's missing)
    // and show the success dialog.
    setLastOrderId(order.orderNumber?.toString() || order.id);
