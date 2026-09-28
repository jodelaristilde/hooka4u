"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Loader2, Upload, X, Image, UtensilsCrossed, CupSoda, Package, Tags, Eye, EyeOff } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

type Category = string;

const titleCase = (s: string) =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const categoryIcon = (name: string) => {
  const upper = (name || "").toUpperCase();
  if (upper === "FOOD") return UtensilsCrossed;
  if (upper === "DRINKS") return CupSoda;
  return Package;
};

const NEW_CATEGORY_VALUE = "__new__";

// Images below this size get a "low resolution" warning on upload.
const MIN_DIMENSION = 600;
// Images larger than this get downscaled before processing/storage.
const MAX_DIMENSION = 1600;

// Simple 3x3 unsharp-mask style convolution to make soft/blurry photos look crisper.
function sharpenImageData(data: Uint8ClampedArray, width: number, height: number) {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(width - 1, Math.max(0, x + kx));
            const sy = Math.min(height - 1, Math.max(0, y + ky));
            sum += data[(sy * width + sx) * 4 + c] * kernel[k];
            k++;
          }
        }
        output[(y * width + x) * 4 + c] = sum;
      }
      output[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
    }
  }

  return output;
}

// Resizes (if needed) and sharpens an uploaded image file, returning a data URL
// plus the image's dimensions so we can warn about low-resolution source photos.
async function processImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = rawDataUrl;
  });

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;
  if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(targetWidth, targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: rawDataUrl, width: originalWidth, height: originalHeight };
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const sharpened = sharpenImageData(imageData.data, targetWidth, targetHeight);
  ctx.putImageData(
    new ImageData(sharpened as unknown as Uint8ClampedArray<ArrayBuffer>, targetWidth, targetHeight),
    0,
    0
  );

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, width: originalWidth, height: originalHeight };
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: Category | null;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbCategory {
  id: string;
  name: string;
  hidden: boolean;
  order: number;
}

export default function MenuItemsPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newManagedCategoryName, setNewManagedCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "" as Category,
  });

  // The full list of category names to show, in order: every category
  // that's been explicitly registered (via Manage Categories), followed by
  // any older category names that only exist because a menu item still
  // uses them (covers categories like "FOOD"/"DRINKS" that predate the
  // category manager). This is what drives the tabs and the item form's
  // category dropdown on THIS admin page — hidden categories still show
  // here so items in them stay manageable; only the customer/staff
  // ordering screens filter hidden ones out.
  const itemOnlyCategoryNames = Array.from(
    new Set(menuItems.map((item) => item.category).filter((c): c is string => !!c))
  ).filter((name) => !dbCategories.some((c) => c.name === name));

  const categories = [
    ...dbCategories.slice().sort((a, b) => a.order - b.order).map((c) => c.name),
    ...itemOnlyCategoryNames.sort(),
  ];

  const isCategoryHidden = (name: string) =>
    dbCategories.find((c) => c.name === name)?.hidden ?? false;

  // Keep the active tab pointing at a real category once items load.
  useEffect(() => {
    if (categories.length === 0) {
      if (activeTab !== "") setActiveTab("");
      return;
    }
    if (!categories.includes(activeTab)) {
      setActiveTab(categories[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join("|")]);

  // Fetch menu items and categories
  useEffect(() => {
    fetchMenuItems();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setDbCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Makes sure a category name has a registered row (so it can be hidden
  // later, and so it survives even if every item in it is deleted).
  // Silently no-ops if it's already registered.
  const ensureCategoryRegistered = async (name: string) => {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed || dbCategories.some((c) => c.name === trimmed)) return;

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (response.ok) {
        const created = await response.json();
        setDbCategories((prev) => [...prev, created]);
      }
    } catch (error) {
      console.error("Error registering category:", error);
    }
  };

  const handleAddManagedCategory = async () => {
    const trimmed = newManagedCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name is required");
      return;
    }

    try {
      setCategorySubmitting(true);
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create category");
      }

      const created = await response.json();
      setDbCategories((prev) => [...prev, created]);
      setNewManagedCategoryName("");
      toast.success("Category added");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add category");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleToggleCategoryHidden = async (name: string) => {
    const existing = dbCategories.find((c) => c.name === name);
    setCategorySubmitting(true);
    try {
      if (existing) {
        const response = await fetch(`/api/categories/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: !existing.hidden }),
        });
        if (!response.ok) throw new Error("Failed to update category");
        const updated = await response.json();
        setDbCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        // Category only exists implicitly via items so far — register it
        // and mark it hidden in one go.
        const response = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) throw new Error("Failed to update category");
        const created = await response.json();
        const patchResponse = await fetch(`/api/categories/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: true }),
        });
        const updated = patchResponse.ok ? await patchResponse.json() : { ...created, hidden: true };
        setDbCategories((prev) => [...prev, updated]);
      }
    } catch (error) {
      console.error("Error toggling category:", error);
      toast.error("Failed to update category");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteManagedCategory = async (name: string) => {
    const existing = dbCategories.find((c) => c.name === name);
    const stillHasItems = menuItems.some((item) => item.category === name);
    if (stillHasItems) {
      toast.error("Category still has items", {
        description: "Move or delete its menu items first, then remove the category.",
      });
      return;
    }
    if (!existing) return;

    try {
      setCategorySubmitting(true);
      const response = await fetch(`/api/categories/${existing.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete category");
      setDbCategories((prev) => prev.filter((c) => c.id !== existing.id));
      toast.success("Category removed");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/menu-items/get-all-items");
      
      if (!response.ok) {
        throw new Error("Failed to fetch menu items");
      }
      
      const data = await response.json();
      setMenuItems(data);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      toast.error("Failed to load menu items", {
        description: "Please try refreshing the page.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Invalid file type", {
        description: "Please select an image file.",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    setImageFile(file);

    try {
      const { dataUrl, width, height } = await processImageFile(file);
      setImagePreview(dataUrl);

      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        toast.warning("Low-resolution image", {
          description:
            "This photo is a bit small and may look soft on the kiosk. We've sharpened it automatically, but a higher-resolution photo will look best.",
        });
      }
    } catch (err) {
      console.error("Error processing image:", err);
      // Fall back to a plain preview if processing fails for any reason.
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenDialog = (item?: MenuItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        name: item.name,
        description: item.description || "",
        category: item.category || activeTab,
      });
      setImagePreview(item.image || null);
    } else {
      setSelectedItem(null);
      setFormData({
        name: "",
        description: "",
        category: activeTab,
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setIsAddingNewCategory(false);
    setNewCategoryInput("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
    setFormData({
      name: "",
      description: "",
      category: activeTab,
    });
    setImagePreview(null);
    setImageFile(null);
    setIsAddingNewCategory(false);
    setNewCategoryInput("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required", {
        description: "Please enter a name for the menu item.",
      });
      return;
    }

    const finalCategory = isAddingNewCategory
      ? newCategoryInput.trim().toUpperCase()
      : formData.category;

    if (!finalCategory) {
      toast.error("Category is required", {
        description: "Please choose or create a category for this item.",
      });
      return;
    }

    try {
      setSubmitting(true);

      // imagePreview already holds the processed (resized/sharpened) image data
      // when a new file was chosen, so use it directly instead of re-reading the
      // raw file (which would discard the sharpening).
      let imageBase64: string | null = selectedItem?.image || null;

      if (imageFile && imagePreview) {
        imageBase64 = imagePreview;
      } else if (imagePreview === null && selectedItem) {
        // Image was removed
        imageBase64 = null;
      }

      const url = selectedItem
        ? `/api/menu-items/${selectedItem.id}`
        : "/api/menu-items";

      const method = selectedItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: selectedItem?.price ?? 0,
          image: imageBase64,
          category: finalCategory,
          available: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${selectedItem ? "update" : "create"} menu item`);
      }

      if (isAddingNewCategory) {
        await ensureCategoryRegistered(finalCategory);
      }

      await fetchMenuItems();
      handleCloseDialog();
      
      toast.success(
        selectedItem ? "Menu item updated!" : "Menu item created!",
        {
          description: selectedItem 
            ? "The menu item has been successfully updated."
            : "The menu item has been successfully created.",
        }
      );
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast.error("Failed to save menu item", {
        description: "Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (item: MenuItem) => {
    setItemToDelete(item);
    setDeleteBlocked(false);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    const item = itemToDelete;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/menu-items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));

        if (response.status === 409 && body.error === "HAS_ORDER_HISTORY") {
          // Don't close the dialog — switch it into "blocked" mode so the
          // person can choose Hide, or confirm a real force-delete.
          setDeleteBlocked(true);
          return;
        }

        throw new Error(body.message || "Failed to delete menu item");
      }

      await fetchMenuItems();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteBlocked(false);

      toast.success("Menu item deleted!", {
        description: "The menu item has been successfully removed.",
      });
    } catch (error) {
      console.error("Error deleting menu item:", error);
      toast.error("Failed to delete menu item", {
        description: "Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Only reachable from the "blocked" delete dialog, after the person has
  // been told this will also remove the item from its past orders' records.
  const handleForceDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/menu-items/${itemToDelete.id}?force=true`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete menu item");
      }

      await fetchMenuItems();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteBlocked(false);

      toast.success("Menu item permanently deleted", {
        description: "It's also been removed from any past orders that included it.",
      });
    } catch (error) {
      console.error("Error force-deleting menu item:", error);
      toast.error("Failed to delete menu item", {
        description: "Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHideFromDeleteDialog = async () => {
    if (!itemToDelete) return;
    await handleToggleItemAvailable(itemToDelete);
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
    setDeleteBlocked(false);
  };

  // Toggling this is how items with order history get "removed" — they
  // can't be hard-deleted (see handleDeleteConfirm), but marking them
  // unavailable takes them off both ordering screens immediately.
  const handleToggleItemAvailable = async (item: MenuItem) => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });

      if (!response.ok) throw new Error("Failed to update menu item");

      await fetchMenuItems();
      toast.success(item.available ? "Item hidden" : "Item shown again", {
        description: item.available
          ? "It no longer shows up on the ordering screens."
          : "It's back on the ordering screens.",
      });
    } catch (error) {
      console.error("Error toggling item availability:", error);
      toast.error("Failed to update item");
    } finally {
      setSubmitting(false);
    }
  };

  const itemsForTab = menuItems.filter((item) => item.category === activeTab);

  const renderGrid = () => (
    loading ? (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Loading menu items...</p>
      </div>
    ) : itemsForTab.length === 0 ? (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No {titleCase(activeTab)} items yet
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first {titleCase(activeTab)} item
            </p>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {titleCase(activeTab)} Item
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {itemsForTab.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {item.image && (
              <div className="w-full h-64 bg-muted relative overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-64 aspect-square"
                />
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-semibold truncate">
                      {item.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {titleCase(item.category || "")}
                    </Badge>
                    {!item.available && (
                      <Badge variant="outline" className="text-xs">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-primary mt-1">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    title={item.available ? "Hide from ordering" : "Show on ordering"}
                    onClick={() => handleToggleItemAvailable(item)}
                  >
                    {item.available ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={() => handleOpenDialog(item)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDeleteClick(item)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {item.description && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    )
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-3 sm:px-5 w-full">
          <SidebarTrigger className="-ml-1 hidden sm:flex" />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink
                  href="#"
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  Menu Management
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground text-sm font-medium">
                  Menu Items
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Menu Items</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your menu items and categories.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(true)}
              >
                <Tags className="w-4 h-4 mr-2" />
                Manage Categories
              </Button>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
            </div>
          </div>

          {categories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No menu items yet
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add your first item and create a category for it (e.g. Food, Drinks, or anything else you sell).
                  </p>
                  <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
              <TabsList>
                {categories.map((cat) => {
                  const Icon = categoryIcon(cat);
                  return (
                    <TabsTrigger key={cat} value={cat} className="gap-1.5">
                      <Icon className="w-4 h-4" />
                      {titleCase(cat)}
                      {isCategoryHidden(cat) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                          Hidden
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {categories.map((cat) => (
                <TabsContent key={cat} value={cat} className="pt-4">
                  {renderGrid()}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? "Edit Menu Item" : "Add New Menu Item"}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? "Update the details of the menu item below."
                : "Create a new menu item and choose its category."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Image (Optional)</Label>
              <div className="space-y-3">
                {imagePreview ? (
                  <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden border-2 border-border">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={handleRemoveImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="w-full h-48 bg-muted rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="w-12 h-12 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">Click to upload image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {!imagePreview && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Cappuccino, Caesar Salad"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              {isAddingNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    id="category"
                    autoFocus
                    placeholder="e.g., Hookah, Merch, Desserts"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingNewCategory(false);
                      setNewCategoryInput("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    if (value === NEW_CATEGORY_VALUE) {
                      setIsAddingNewCategory(true);
                      setNewCategoryInput("");
                    } else {
                      setFormData({ ...formData, category: value as Category });
                    }
                  }}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {titleCase(cat)}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_CATEGORY_VALUE}>
                      + Add new category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter a brief description of the item..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Price</span>
                <span className="text-lg font-bold text-primary">
                  ${(selectedItem?.price ?? 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedItem
                  ? "Update the price from the Menu Prices page."
                  : "Price is set to $0.00 by default and can be updated later."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {selectedItem ? "Updating..." : "Creating..."}
                </>
              ) : (
                selectedItem ? "Update Item" : "Create Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Add new categories, or hide ones you don&apos;t use (like Food or Drinks) so
              they no longer show up on the ordering screens. Hidden categories and their
              items stay here so you can bring them back anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Clothes, Merch, Accessories"
                value={newManagedCategoryName}
                onChange={(e) => setNewManagedCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddManagedCategory();
                }}
                disabled={categorySubmitting}
              />
              <Button
                onClick={handleAddManagedCategory}
                disabled={categorySubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No categories yet. Add one above.
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const hidden = isCategoryHidden(cat);
                  const itemCount = menuItems.filter((item) => item.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between gap-2 border border-border rounded-lg p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {titleCase(cat)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                          {hidden ? " · hidden from ordering" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={categorySubmitting}
                          onClick={() => handleToggleCategoryHidden(cat)}
                        >
                          {hidden ? (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              Show
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4 mr-1" />
                              Hide
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          disabled={categorySubmitting || itemCount > 0}
                          title={itemCount > 0 ? "Remove its items first" : "Delete category"}
                          onClick={() => handleDeleteManagedCategory(cat)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsCategoryDialogOpen(false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeleteBlocked(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {deleteBlocked ? (
              <>
                <AlertDialogTitle>This item is part of past orders</AlertDialogTitle>
                <AlertDialogDescription>
                  &quot;{itemToDelete?.name}&quot; has already been ordered before. You can hide
                  it instead — that keeps your order history intact and removes it from ordering
                  right away — or delete it anyway, which will also remove it from those past
                  orders&apos; records. This cannot be undone.
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &quot;{itemToDelete?.name}&quot;. This action cannot be undone.
                </AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            {deleteBlocked ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={handleHideFromDeleteDialog}
                >
                  Hide Instead
                </Button>
                <AlertDialogAction
                  onClick={handleForceDeleteConfirm}
                  disabled={submitting}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Anyway"
                  )}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="bg-destructive hover:bg-destructive/90 text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
