"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, CheckCircle2, Clock, AlertCircle } from "lucide-react"

interface OrderStatusResult {
  orderNumber: number
  status: "PENDING" | "DELIVERED" | string
  customerName: string
  createdAt: string
}

export default function OrderStatusPage() {
  const [input, setInput] = useState("")
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null)
  const [result, setResult] = useState<OrderStatusResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const lookup = async (orderNumber: string, quiet = false) => {
    if (!quiet) {
      setLoading(true)
      setError(null)
    }
    try {
      const response = await fetch(`/api/orders/status?orderNumber=${encodeURIComponent(orderNumber)}`)
      if (!response.ok) {
        setResult(null)
        setError(response.status === 404 ? "We couldn't find an order with that number." : "Something went wrong looking that up.")
        return
      }
      const data: OrderStatusResult = await response.json()
      setResult(data)
      setError(null)
    } catch (err) {
      console.error("Error checking order status:", err)
      if (!quiet) setError("Something went wrong looking that up.")
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    setActiveOrderNumber(trimmed)
    lookup(trimmed)
  }

  // Auto-refresh the status every 5 seconds while a result is being shown,
  // so a guest watching the page sees it flip to "Delivered" automatically.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (activeOrderNumber) {
      pollRef.current = setInterval(() => {
        lookup(activeOrderNumber, true)
      }, 5000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderNumber])

  const isDelivered = result?.status === "DELIVERED"

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
          Check Your Order
        </h1>
        <p className="text-zinc-400 text-center text-sm mb-8">
          Enter your order number to see if it's ready.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g., 104"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-12 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 px-4 text-lg focus:outline-none focus:ring-2 focus:ring-lime-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 px-5 rounded-lg bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:hover:bg-lime-500 text-black font-semibold flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            <span className="hidden sm:inline">Check</span>
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {result && !error && (
          <div className="rounded-2xl border-4 border-lime-500 bg-zinc-900 p-6 flex flex-col items-center gap-4">
            <p className="text-sm uppercase tracking-widest text-zinc-400">Order Number</p>
            <p className="text-6xl font-black text-lime-500 tabular-nums">{result.orderNumber}</p>

            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
                isDelivered
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              }`}
            >
              {isDelivered ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {isDelivered ? "Delivered" : "Pending"}
            </div>

            <p className="text-zinc-500 text-xs">
              This page updates automatically every few seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
