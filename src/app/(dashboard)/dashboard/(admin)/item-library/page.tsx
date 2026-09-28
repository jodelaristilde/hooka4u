"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, Upload, X, Image as ImageIcon, ShoppingCart, Library } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

// Images below this size get a "low resolution" warning on upload.
const MIN_DIMENSION = 600;
// Every photo is center-cropped to a square and scaled to this size — same
// pipeline as the live Menu page, so library photos and menu photos always
// come out looking consistent.
const OUTPUT_SIZE = 900;

// --- Image processing (mirrors the Menu admin page's pipeline) ---------

function autoEnhanceImageData(data: Uint8ClampedArray, width: number, height: number) {
  const totalPixels = width * height;
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }

  const findBounds = (hist: number[]) => {
    const lowCutoff = totalPixels * 0.01;
    const highCutoff = totalPixels * 0.99;
    let cumulative = 0;
    let low = 0;
    let high = 255;

    for (let v = 0; v < 256; v++) {
      cumulative += hist[v];
      if (cumulative >= lowCutoff) {
        low = v;
        break;
      }
    }

    cumulative = 0;
    for (let v = 255; v >= 0; v--) {
      cumulative += hist[v];
      if (cumulative >= totalPixels - highCutoff) {
        high = v;
        break;
      }
    }

    if (high <= low) return { low: 0, high: 255 };
    return { low, high };
  };

  const rBounds = findBounds(histR);
  const gBounds = findBounds(histG);
  const bBounds = findBounds(histB);

  const buildLut = (low: number, high: number) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      if (v <= low) lut[v] = 0;
      else if (v >= high) lut[v] = 255;
      else lut[v] = Math.round(((v - low) / (high - low)) * 255);
    }
    return lut;
  };

  const rLut = buildLut(rBounds.low, rBounds.high);
  const gLut = buildLut(gBounds.low, gBounds.high);
  const bLut = buildLut(bBounds.low, bBounds.high);

  const saturationBoost = 1.15;
  for (let i = 0; i < data.length; i += 4) {
    const r = rLut[data[i]];
    const g = gLut[data[i + 1]];
    const b = bLut[data[i + 2]];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = Math.min(255, Math.max(0, gray + (r - gray) * saturationBoost));
    data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * saturationBoost));
    data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * saturationBoost));
  }
}

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

  const side = Math.min(originalWidth, originalHeight);
  const sx = (originalWidth - side) / 2;
  const sy = (originalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: rawDataUrl, width: originalWidth, height: originalHeight };
  }

  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const imageData = ctx.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  autoEnhanceImageData(imageData.data, OUTPUT_SIZE, OUTPUT_SIZE);
  const sharpened = sharpenImageData(imageData.data, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.putImageData(
    new ImageData(sharpened as unknown as Uint8ClampedArray<ArrayBuffer>, OUTPUT_SIZE, OUTPUT_SIZE),
    0,
    0
  );

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, width: originalWidth, height: originalHeight };
}

// -------------------------------------------------------------------------

interface MenuItemTemplate {
  id: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbCategory {
  id: string;
  name: string;
  hidden: boolean;
  order: number;
}

export default function ItemLibraryPage() {
  const [templates, setTemplates] = useState<MenuItemTemplate[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({ name: "", description: "", category: "" });

  const [templateToDelete, setTemplateToDelete] = useState<MenuItemTemplate | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [addToMenuTemplate, setAddToMenuTemplate] = useState<MenuItemTemplate | null>(null);
  const [addToMenuPrice, setAddToMenuPrice] = useState("");
  const [addingToMenu, setAddingToMenu] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/menu-templates");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load item library");
    } finally {
      setLoading(false);
    }
  };

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", { description: "Please select an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Please select an image smaller than 5MB." });
      return;
    }

    setImageFile(file);

    try {
      const { dataUrl, width, height } = await processImageFile(file);
      setImagePreview(dataUrl);

      if (Math.min(width, height) < MIN_DIMENSION) {
        toast.warning("Low-resolution image", {
          description:
            "This photo is a bit small and may look soft on the kiosk. We've enhanced and sharpened it automatically, but a higher-resolution photo will look best.",
        });
      }
    } catch (err) {
      console.error("Error processing image:", err);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openAddDialog = () => {
    setFormData({ name: "", description: "", category: dbCategories[0]?.name || "" });
    setImagePreview(null);
    setImageFile(null);
    setIsDialogOpen(true);
  };

  const closeAddDialog = () => {
    setIsDialogOpen(false);
    setFormData({ name: "", description: "", category: "" });
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required", { description: "Please enter a name for the item." });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/menu-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          image: imagePreview,
          category: formData.category || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to save item");

      await fetchTemplates();
      closeAddDialog();
      toast.success("Saved to library", {
        description: `${formData.name} is ready to add to the menu anytime.`,
      });
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save item", { description: "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (template: MenuItemTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/menu-templates/${templateToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");

      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      toast.success("Removed from library");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const openAddToMenuDialog = (template: MenuItemTemplate) => {
    setAddToMenuTemplate(template);
    setAddToMenuPrice("");
  };

  const closeAddToMenuDialog = () => {
    setAddToMenuTemplate(null);
    setAddToMenuPrice("");
  };

  const handleAddToMenuConfirm = async () => {
    if (!addToMenuTemplate) return;

    const priceValue = parseFloat(addToMenuPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error("Invalid price", { description: "Enter a valid price ≥ 0." });
      return;
    }

    try {
      setAddingToMenu(true);
      const response = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addToMenuTemplate.name,
          description: addToMenuTemplate.description,
          image: addToMenuTemplate.image,
          category: addToMenuTemplate.category,
          price: priceValue,
          available: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to add to menu");

      toast.success("Added to menu!", {
        description: `${addToMenuTemplate.name} is now live for ordering.`,
      });
      closeAddToMenuDialog();
    } catch (error) {
      console.error("Error adding to menu:", error);
      toast.error("Failed to add to menu", { description: "Please try again." });
    } finally {
      setAddingToMenu(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 px-3 sm:px-5 w-full">
          <SidebarTrigger className="-ml-1 hidden sm:flex" />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#" className="text-muted-foreground hover:text-foreground text-sm">
                  Admin
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-foreground text-sm font-medium">Item Library</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Library className="h-6 w-6 text-lime-600" />
                Item Library
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Save a photo, name, description and category once. Washup and menu resets never touch this —
                reuse any saved item to add it back to the live menu in one click, no re-uploading.
              </p>
            </div>
            <Button onClick={openAddDialog} className="bg-lime-500 hover:bg-lime-400 text-zinc-950">
              <Plus className="h-4 w-4 mr-1" />
              Save New Item
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-foreground">Your library is empty</p>
                <p className="text-sm mt-1">Save an item's photo and details here so you don't have to re-upload it every time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="overflow-hidden group">
                  <div className="aspect-square bg-muted relative">
                    {template.image ? (
                      <img
                        src={template.image}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <button
                      onClick={() => handleDeleteClick(template)}
                      title="Remove from library"
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div>
                      <p className="font-medium text-sm truncate">{template.name}</p>
                      {template.category && (
                        <Badge variant="outline" className="mt-1 text-[10px] bg-lime-50 text-lime-700 border-lime-200">
                          {template.category}
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-lime-500 hover:bg-lime-400 text-zinc-950"
                      onClick={() => openAddToMenuDialog(template)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                      Add to Menu
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save New Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeAddDialog())}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save Item to Library</DialogTitle>
            <DialogDescription>
              This saves a photo and description you can reuse to quickly add the item back to the live menu later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Image</Label>
              {imagePreview ? (
                <div className="relative w-32 h-32">
                  <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-lime-400 hover:text-lime-600 transition-colors"
                >
                  <Upload className="h-5 w-5 mb-1" />
                  <span className="text-xs">Upload</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Blue Hawaiian Hookah"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short description shown to customers"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {dbCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={submitting} className="bg-lime-500 hover:bg-lime-400 text-zinc-950">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Menu Dialog */}
      <Dialog open={!!addToMenuTemplate} onOpenChange={(open) => !open && closeAddToMenuDialog()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add "{addToMenuTemplate?.name}" to the menu</DialogTitle>
            <DialogDescription>
              This creates a live, orderable menu item using the saved photo and description. Just set a price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="add-to-menu-price">Price</Label>
            <Input
              id="add-to-menu-price"
              type="number"
              min="0"
              step="0.01"
              value={addToMenuPrice}
              onChange={(e) => setAddToMenuPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddToMenuDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToMenuConfirm}
              disabled={addingToMenu}
              className="bg-lime-500 hover:bg-lime-400 text-zinc-950"
            >
              {addingToMenu ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add to Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes "{templateToDelete?.name}" from the item library. It won't affect anything currently
              on the live menu — only the saved copy goes away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
