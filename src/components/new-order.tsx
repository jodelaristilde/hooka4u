"use client"

import { EmptyHookahState } from "@/components/empty-hookah-state"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Loader2, Minus, Plus, ShoppingCart, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface Product {
  id: string
  name: string
  image: string
  price: number
  description?: string
  category?: "FOOD" | "DRINKS"
}

interface CartItem extends Product {
  quantity: number
}

interface CartState {
  [key: string]: CartItem
}

interface NewOrderProps {
  category: "FOOD" | "DRINKS"
  onOrderComplete?: () => void
  onBack?: () => void
}

export default function NewOrder({ category, onOrderComplete, onBack }: NewOrderProps) {
  const [customerName, setCustomerName] = useState("")
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "">("")
  const [seating, setSeating] = useState("")
  const [cart, setCart] = useState<CartState>({})
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [mobileSheetView, setMobileSheetView] = useState<"cart" | "form">("cart")
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<string>("")

  // Fetch products from database
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/menu-items?category=${category}`)

        if (!response.ok) {
          throw new Error("Failed to fetch menu items")
        }

        const json = await response.json()
        const data: Product[] = Array.isArray(json) ? (json as Product[]) : []
        setProducts(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products")
        console.error("Error fetching products:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [category])

  const addToCart = (product: Product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        quantity: (prev[product.id]?.quantity || 0) + 1,
      },
    }))
  }

  const updateQuantity = (productId: string, change: number) => {
    setCart((prev) => {
      const currentQty = prev[productId]?.quantity || 0
      const newQty = currentQty + change

      if (newQty <= 0) {
        const { [productId]: removed, ...rest } = prev
        return rest
      }

      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity: newQty,
        },
      }
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const { [productId]: removed, ...rest } = prev
      return rest
    })
  }

  const handleProductClick = (product: Product) => {
    const inCart = cart[product.id]
    if (inCart && inCart.quantity === 1) {
      removeFromCart(product.id)
    } else {
      addToCart(product)
    }
  }

  const handlePlaceOrderClick = () => {
    if (cartItems.length === 0) return
    setShowOrderForm(true)
  }

  const handleMobileOrderButton = () => {
    setIsMobileSheetOpen(true)
    setMobileSheetView("cart")
  }

  const handleMobileSheetPlaceOrder = () => {
    if (cartItems.length === 0) return
    setMobileSheetView("form")
  }

  const handleMobileSheetBackToCart = () => {
    setMobileSheetView("cart")
  }

  const handleBackToCart = () => {
    setShowOrderForm(false)
  }

  const handleConfirmOrder = async () => {
    if (!customerName.trim()) {
      toast.info("Customer name is required", {
        description: "Please enter a customer name before placing the order.",
        action: {
          label: "Close",
          onClick: () => console.log("Toast Closed"),
        },
      })
      return
    }

    if (!paymentType) {
      toast.info("Payment type is required", {
        description: "Please select a payment type before placing the order.",
        action: {
          label: "Close",
          onClick: () => console.log("Toast Closed"),
        },
      })
      return
    }

    if (!seating.trim()) {
      toast.info("Seating Location is required", {
        description: "Please enter a seating location before placing the order.",
        action: {
          label: "Close",
          onClick: () => console.log("Toast Closed"),
        },
      })
      return
    }

    try {
      setSubmitting(true)
      const orderData = {
        customerName: customerName.trim(),
        paymentType,
        Seating: seating.trim() || null,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        subtotal,
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        throw new Error("Failed to place order")
      }

      const order = await response.json()

      setLastOrderId(order.id)
      setShowSuccessDialog(true)

      setCart({})
      setCustomerName("")
      setPaymentType("")
      setSeating("")
      setShowOrderForm(false)
      setIsCartOpen(false)
      setIsMobileSheetOpen(false)
      setMobileSheetView("cart")

      // Auto-return to the welcome screen a few seconds after a successful order,
      // so the kiosk is ready for the next customer.
      setTimeout(() => {
        setShowSuccessDialog(false)
        onOrderComplete?.()
      }, 3000)
    } catch (err) {
      console.error("Error placing order:", err)
      toast.error("We are sorry to say, but your order cannot be placed", {
        description: "Please try again later!",
        action: {
          label: "Close",
          onClick: () => console.log("Toast Closed"),
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  const cartItems = Object.values(cart)
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0">
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-sm">Loading menu items...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-destructive text-sm font-medium mb-2">Error loading products</div>
                <p className="text-muted-foreground text-xs">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 bg-transparent"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <EmptyHookahState />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {products.map((product) => {
                  const inCart = cart[product.id]
                  const isSelected = inCart && inCart.quantity > 0

                  return (
<div
  key={product.id}
  className={`cursor-pointer transition-all active:scale-[0.97] border overflow-hidden rounded-lg relative ${
    isSelected
      ? "bg-lime-100 dark:bg-lime-950 shadow-md border-lime-300 dark:border-lime-800"
      : "border-zinc-700 bg-zinc-800 hover:border-lime-500 hover:shadow-sm"
  }`}
  onClick={() => handleProductClick(product)}
>
  {/* Square Image Container */}
  <div className="relative w-full aspect-square bg-zinc-900 overflow-hidden">

    {/* Product Image */}
    {product.image ? (
      <img
        src={product.image || "/placeholder.svg"}
        alt={product.name}
        className="absolute inset-0 w-full h-full object-cover"
      />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
        <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-700" />
      </div>
    )}



    {/* Quantity Badge */}
    {isSelected && (
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-red-500 text-white w-6 h-6 sm:px-2 sm:py-1 sm:w-auto sm:h-auto flex items-center justify-center text-xs font-medium rounded-full shadow-md">
        {inCart.quantity}
      </div>
    )}

    {/* Bottom Overlay */}
    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-4 bg-gradient-to-t from-black/85 via-black/55 to-transparent space-y-1 sm:space-y-2 text-center sm:text-left">
    {/* Price Badge */}
    <div className="mx-auto sm:mx-0 w-fit bg-lime-500 text-black text-xs sm:text-base font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-md">
      ${product.price.toFixed(2)}
    </div>
      {/* Title */}
      <h3 className="text-white font-semibold text-sm sm:text-xl md:text-2xl leading-tight line-clamp-2 break-words">
        {product.name}
      </h3>

      {/* Description */}
      {product.description && (
        <p className="hidden sm:block text-zinc-300 text-xs line-clamp-2">
          {product.description}
        </p>
      )}

      {/* Add to Cart Button */}
      <button
        className="w-full mt-1 sm:mt-2 bg-lime-500 hover:bg-lime-400 text-black text-xs sm:text-base font-semibold py-2 sm:py-3.5 rounded-md transition active:scale-95"
      >
        <span className="sm:hidden">Add</span>
        <span className="hidden sm:inline">Add to Cart</span>
      </button>
    </div>
  </div>
</div>

                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Cart Sidebar */}
        <div
          className={`hidden md:flex flex-col transition-all duration-300 ease-in-out border-l border-border bg-zinc-250 text-white ${
            isCartOpen ? "w-[400px]" : "w-0"
          } overflow-hidden`}
        >
          {isCartOpen && !showOrderForm && (
            <>
              {/* Cart Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-lime-500" />
                  Current Order
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-zinc-800 text-white"
                  onClick={() => setIsCartOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                    <p className="font-medium text-sm">No items yet</p>
                    <p className="text-xs text-center mt-1 text-zinc-500">Select products to start</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.id} className="bg-zinc-800 rounded-lg p-3.5 border border-zinc-700 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-white truncate">{item.name}</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">${item.price.toFixed(2)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 -mt-1 -mr-1 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors active:scale-90"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 border-zinc-700 hover:bg-zinc-700 bg-transparent text-white hover:text-white active:scale-90 transition-transform"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold text-base text-white">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 border-zinc-700 hover:bg-zinc-700 bg-transparent text-white hover:text-white active:scale-90 transition-transform"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <span className="font-semibold text-sm
