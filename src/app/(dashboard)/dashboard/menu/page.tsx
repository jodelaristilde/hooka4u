"use client"

import { useEffect, useState } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, Trash2, UtensilsCrossed, CupSoda } from "lucide-react"

interface MenuItem {
  id: string
  name: string
  description?: string | null
  image?: string | null
  price: number
  category?: "FOOD" | "DRINKS" | null
  available: boolean
}

function CategoryFolder({
  category,
  items,
  loading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  category: "FOOD" | "DRINKS"
  items: MenuItem[]
  loading: boolean
  onAdd: (data: { name: string; description: string; price: string; image: string | null }) => Promise<void>
  onUpdate: (id: string, data: Partial<MenuItem>) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) {
      alert("Name and price are required.")
      return
    }
    setSubmitting(true)
    await onAdd({ name, description, price, image: imageBase64 })
    setName("")
    setDescription("")
    setPrice("")
    setImageBase64(null)
    setSubmitting(false)
  }

  const itemsInCategory = items.filter((it) => it.category === category)

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">
          Add {category === "FOOD" ? "Food" : "Drink"} Item
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`name-${category}`}>Name *</Label>
              <Input
                id={`name-${category}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Item name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`price-${category}`}>Price *</Label>
              <Input
                id={`price-${category}`}
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`desc-${category}`}>Description</Label>
            <Input
              id={`desc-${category}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`image-${category}`}>Image</Label>
            <input
              id={`image-${category}`}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm"
            />
            {imageBase64 && (
              <img
                src={imageBase64}
                alt="Preview"
                className="mt-2 w-20 h-20 object-cover rounded-md border"
              />
            )}
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Add to ${category === "FOOD" ? "Food" : "Drinks"}`
            )}
          </Button>
        </form>
      </Card>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          {category === "FOOD" ? "Food" : "Drinks"} Items{" "}
          {loading ? "" : `(${itemsInCategory.length})`}
        </h3>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : itemsInCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {category === "FOOD" ? "food" : "drink"} items yet — add one above.
          </p>
        ) : (
          <div className="space-y-3">
            {itemsInCategory.map((item) => (
              <Card key={item.id} className="p-4 flex flex-row items-center gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 bg-muted rounded-md flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={item.available}
                    onChange={(e) =>
                      onUpdate(item.id, { available: e.target.checked })
                    }
                  />
                  Available
                </label>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(item.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MenuAdminPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/menu-items?admin=true")
      if (!res.ok) throw new Error("Failed to load items")
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleAdd = async (
    category: "FOOD" | "DRINKS",
    data: { name: string; description: string; price: string; image: string | null }
  ) => {
    try {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description.trim() || null,
          price: parseFloat(data.price),
          category,
          available: true,
          image: data.image,
        }),
      })
      if (!res.ok) throw new Error("Failed to add item")
      await fetchItems()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add item")
    }
  }

  const handleUpdate = async (id: string, data: Partial<MenuItem>) => {
    try {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update item")
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...data } as MenuItem : it))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update item")
    }
  }

  const handleDelete = async (id: string) => {
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
    <div>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 hidden sm:flex" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Menu</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Menu</h2>
          <p className="text-sm text-muted-foreground">
            Manage menu items and categories
          </p>
        </div>

        <Tabs defaultValue="FOOD">
          <TabsList>
            <TabsTrigger value="FOOD" className="gap-1.5">
              <UtensilsCrossed className="w-4 h-4" />
              Food
            </TabsTrigger>
            <TabsTrigger value="DRINKS" className="gap-1.5">
              <CupSoda className="w-4 h-4" />
              Drinks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="FOOD" className="pt-4">
            <CategoryFolder
              category="FOOD"
              items={items}
              loading={loading}
              onAdd={(data) => handleAdd("FOOD", data)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </TabsContent>

          <TabsContent value="DRINKS" className="pt-4">
            <CategoryFolder
              category="DRINKS"
              items={items}
              loading={loading}
              onAdd={(data) => handleAdd("DRINKS", data)}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
