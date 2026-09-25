"use client"

import { useEffect, useState } from "react"

interface MenuItem {
  id: string
  name: string
  description?: string | null
  image?: string | null
  price: number
  category?: "FOOD" | "DRINKS" | null
  available: boolean
}

export default function AdminPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState<"FOOD" | "DRINKS" | "">("")
  const [available, setAvailable] = useState(true)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/menu-items?admin=true")
      if (!res.ok) throw new Error("Failed to load items")
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load items")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageBase64(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price || !category) {
      alert("Name, price, and category are required.")
      return
    }
    try {
      setSubmitting(true)
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price: parseFloat(price),
          category,
          available,
          image: imageBase64,
        }),
      })
      if (!res.ok) throw new Error("Failed to add item")
      setName("")
      setDescription("")
      setPrice("")
      setCategory("")
      setAvailable(true)
      setImageBase64(null)
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setSubmitting(false)
    }
  }

  const updateItem = async (id: string, data: Partial<MenuItem>) => {
    try {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update item")
      const updated = await res.json()
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update item")
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return
    try {
      const res = await fetch(`/api/menu-items/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete item")
      setItems((prev) => prev.filter((it) => it.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete item")
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-8" style={{ fontFamily: "Georgia, serif" }}>
          Menu Admin
        </h1>

        {/* Add New Item Form */}
        <form
          onSubmit={handleAddItem}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-10 space-y-4"
        >
          <h2 className="text-xl font-semibold text-lime-500">Add New Item</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-sm"
              placeholder="Item name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-sm"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-sm"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as "FOOD" | "DRINKS" | "")}
                className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 px-3 text-sm"
              >
                <option value="">Select category</option>
                <option value="FOOD">Food</option>
                <option value="DRINKS">Drinks</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
            {imageBase64 && (
              <img src={imageBase64} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-md" />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available (visible to customers)
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="bg-lime-500 hover:bg-lime-400 text-black font-semibold px-6 py-2.5 rounded-md transition disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add Item"}
          </button>
        </form>

        {/* Existing Items */}
        <h2 className="text-xl font-semibold text-lime-500 mb-4">
          Existing Items {loading ? "" : `(${items.length})`}
        </h2>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-zinc-400">No items yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4"
              >
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-zinc-800 rounded-md flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-sm text-zinc-400">${item.price.toFixed(2)}</p>
                </div>

                <select
                  value={item.category ?? ""}
                  onChange={(e) =>
                    updateItem(item.id, {
                      category: (e.target.value || null) as "FOOD" | "DRINKS" | null,
                    })
                  }
                  className="h-9 rounded-md bg-zinc-800 border border-zinc-700 px-2 text-sm"
                >
                  <option value="">No category</option>
                  <option value="FOOD">Food</option>
                  <option value="DRINKS">Drinks</option>
                </select>

                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(e) => updateItem(item.id, { available: e.target.checked })}
                  />
                  Available
                </label>

                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-red-400 hover:text-red-300 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
