"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2, Upload, X, Image as ImageIcon, ShoppingCart, Library, CheckSquare, Check } from "lucide-react";
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
import { useBrand } from "@/lib/use-brand";

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

// One selected-but-not-yet-saved photo in the "Save New Item(s)" dialog.
interface BatchItem {
  localId: string;
  file: File;
  preview: string | null;
  name: string;
  description: string;
  processing: boolean;
}

// Turns a filename like "blue-hawaiian_hookah.jpg" into a starting guess at
// a name ("Blue hawaiian hookah") — saves typing, and it's fully editable.
const deriveNameFromFilename = (filename: string) => {
  const base = filename.replace(/\.[^/.]+$/, "");
  const spaced = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced.length === 0 ? "" : spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Catches the case where a photo's filename was itself a random ID (common
// from messaging apps, cloud downloads, or AI-generated images) — the
// auto-suggested name above would just turn its dashes into spaces,
// producing something like "68C5F670 A8DC 4318 AB96 1C0A93F9B..." instead
// of a real item name. Flags any name that, once spaces are removed, is a
// long run of nothing but hex characters — virtually never true of an
// actual food/drink name, but exactly what a raw ID looks like.
const looksLikeFilenameId = (name: string) => {
  const compact = name.replace(/\s+/g, "");
  return compact.length >= 20 && /^[0-9a-fA-F]+$/.test(compact);
};

export default function ItemLibraryPage() {
  const brand = useBrand();
  const isJaeky = brand.site === "jaeky";
  const primaryBtnClass = isJaeky
    ? "bg-purple-500 hover:bg-purple-400 text-white"
    : "bg-lime-500 hover:bg-lime-400 text-zinc-950";
  const [templates, setTemplates] = useState<MenuItemTemplate[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchCategory, setBatchCategory] = useState("");
  const filesInputRef = useRef<HTMLInputElement>(null);

  const [templateToDelete, setTemplateToDelete] = useState<MenuItemTemplate | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [addToMenuTemplate, setAddToMenuTemplate] = useState<MenuItemTemplate | null>(null);
  const [addToMenuPrice, setAddToMenuPrice] = useState("");
  const [addToMenuCategory, setAddToMenuCategory] = useState("");
  const [addingToMenu, setAddingToMenu] = useState(false);

  // Multi-select: pick several library items at once and file them all
  // under one category/price in a single trip.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkPrice, setBulkPrice] = useState("0.00");
  const [bulkAdding, setBulkAdding] = useState(false);

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

  // Handles picking several photos at once. Each one gets processed
  // (cropped/enhanced/sharpened) independently and its thumbnail fills in
  // as soon as it's ready, so a big batch doesn't feel like it's frozen.
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`Skipped "${file.name}"`, { description: "Not an image file." });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Skipped "${file.name}"`, { description: "Larger than 5MB." });
        return false;
      }
      return true;
    });

    const newItems: BatchItem[] = validFiles.map((file) => ({
      localId: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: null,
      name: deriveNameFromFilename(file.name),
      description: "",
      processing: true,
    }));

    setBatchItems((prev) => [...prev, ...newItems]);

    newItems.forEach(async (item) => {
      try {
        const { dataUrl, width, height } = await processImageFile(item.file);
        setBatchItems((prev) =>
          prev.map((it) => (it.localId === item.localId ? { ...it, preview: dataUrl, processing: false } : it))
        );
        if (Math.min(width, height) < MIN_DIMENSION) {
          toast.warning(`"${item.name || item.file.name}" is low-resolution`, {
            description: "Enhanced and sharpened automatically, but a higher-res photo will look best.",
          });
        }
      } catch (err) {
        console.error("Error processing image:", err);
        setBatchItems((prev) => prev.map((it) => (it.localId === item.localId ? { ...it, processing: false } : it)));
        toast.error(`Failed to process "${item.file.name}"`);
      }
    });

    if (filesInputRef.current) filesInputRef.current.value = "";
  };

  const handleRemoveBatchItem = (localId: string) => {
    setBatchItems((prev) => prev.filter((it) => it.localId !== localId));
  };

  const handleBatchNameChange = (localId: string, name: string) => {
    setBatchItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, name } : it)));
  };

  const handleBatchDescriptionChange = (localId: string, description: string) => {
    setBatchItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, description } : it)));
  };

  const openAddDialog = () => {
    setBatchItems([]);
    setBatchCategory("");
    setIsDialogOpen(true);
  };

  const closeAddDialog = () => {
    setIsDialogOpen(false);
    setBatchItems([]);
    setBatchCategory("");
    if (filesInputRef.current) filesInputRef.current.value = "";
  };

  const handleSaveBatch = async () => {
    if (batchItems.length === 0) {
      toast.error("Add at least one photo first");
      return;
    }
    if (batchItems.some((it) => it.processing)) {
      toast.error("Still processing photos", { description: "Give it a second and try again." });
      return;
    }
    if (batchItems.some((it) => !it.name.trim())) {
      toast.error("Every item needs a name");
      return;
    }
    const idLikeItem = batchItems.find((it) => looksLikeFilenameId(it.name.trim()));
    if (idLikeItem) {
      toast.error("That name looks like a photo ID, not an item name", {
        description: `"${idLikeItem.name.trim().slice(0, 40)}${idLikeItem.name.trim().length > 40 ? "…" : ""}" — please type a real name for this item before saving.`,
      });
      return;
    }

    try {
      setSubmitting(true);
      let successCount = 0;
      for (const item of batchItems) {
        const response = await fetch("/api/menu-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name.trim(),
            description: item.description.trim(),
            image: item.preview,
            category: batchCategory || null,
          }),
        });
        if (response.ok) successCount++;
      }

      await fetchTemplates();
      closeAddDialog();

      if (successCount === batchItems.length) {
        toast.success(`Saved ${successCount} item${successCount === 1 ? "" : "s"} to library`, {
          description: batchCategory ? `Filed under ${batchCategory}.` : "No category set.",
        });
      } else {
        toast.warning(`Saved ${successCount} of ${batchItems.length} items`, {
          description: "Some items failed to save — try adding the rest again.",
        });
      }
    } catch (error) {
      console.error("Error saving batch:", error);
      toast.error("Failed to save items", { description: "Please try again." });
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
    setAddToMenuPrice("0.00");
    setAddToMenuCategory(template.category || "");
  };

  const closeAddToMenuDialog = () => {
    setAddToMenuTemplate(null);
    setAddToMenuPrice("");
    setAddToMenuCategory("");
  };

  const handleAddToMenuConfirm = async () => {
    if (!addToMenuTemplate) return;

    const priceValue = parseFloat(addToMenuPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error("Invalid price", { description: "Enter a valid price ≥ 0." });
      return;
    }

    if (!addToMenuCategory) {
      toast.error("Category is required", { description: "Choose which category this item goes in on the live menu." });
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
          category: addToMenuCategory,
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

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleItemSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkAddDialog = () => {
    if (selectedIds.size === 0) return;
    setBulkPrice("0.00");
    setBulkCategory("");
    setIsBulkAddOpen(true);
  };

  const closeBulkAddDialog = () => {
    setIsBulkAddOpen(false);
    setBulkPrice("");
    setBulkCategory("");
  };

  const handleBulkAddConfirm = async () => {
    const priceValue = parseFloat(bulkPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error("Invalid price", { description: "Enter a valid price ≥ 0." });
      return;
    }

    if (!bulkCategory) {
      toast.error("Category is required", { description: "Choose which category these items go in on the live menu." });
      return;
    }

    const selectedTemplates = templates.filter((t) => selectedIds.has(t.id));
    if (selectedTemplates.length === 0) return;

    try {
      setBulkAdding(true);
      let successCount = 0;
      for (const template of selectedTemplates) {
        const response = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            image: template.image,
            category: bulkCategory,
            price: priceValue,
            available: true,
          }),
        });
        if (response.ok) successCount++;
      }

      if (successCount === selectedTemplates.length) {
        toast.success(`Added ${successCount} item${successCount === 1 ? "" : "s"} to menu!`, {
          description: `Filed under ${bulkCategory}.`,
        });
      } else {
        toast.warning(`Added ${successCount} of ${selectedTemplates.length} items`, {
          description: "Some items failed to add — try the rest again.",
        });
      }

      closeBulkAddDialog();
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error bulk adding to menu:", error);
      toast.error("Failed to add items", { description: "Please try again." });
    } finally {
      setBulkAdding(false);
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
                <Library className={`h-6 w-6 ${brand.accentText}`} />
                Item Library
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Save a photo, name, description and category once. Washup and menu resets never touch this —
                reuse any saved item to add it back to the live menu in one click, no re-uploading.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <Button variant="outline" onClick={toggleSelectMode}>
                  {selectMode ? (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Select Items
                    </>
                  )}
                </Button>
              )}
              <Button onClick={openAddDialog} className={primaryBtnClass}>
                <Plus className="h-4 w-4 mr-1" />
                Save New Item
              </Button>
            </div>
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
              {templates.map((template) => {
                const isSelected = selectedIds.has(template.id);
                return (
                  <Card
                    key={template.id}
                    className={`overflow-hidden group ${selectMode ? "cursor-pointer" : ""} ${
                      isSelected ? (isJaeky ? "ring-2 ring-purple-500" : "ring-2 ring-lime-500") : ""
                    }`}
                    onClick={() => selectMode && toggleItemSelected(template.id)}
                  >
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
                      {selectMode ? (
                        <div
                          className={`absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected
                              ? isJaeky
                                ? "bg-purple-500 border-purple-500 text-white"
                                : "bg-lime-500 border-lime-500 text-zinc-950"
                              : "bg-white/80 border-white text-transparent"
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(template);
                          }}
                          title="Remove from library"
                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div>
                        <p className="font-medium text-sm truncate">{template.name}</p>
                        {template.category && (
                          <Badge
                            variant="outline"
                            className={
                              isJaeky
                                ? "mt-1 text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                                : "mt-1 text-[10px] bg-lime-50 text-lime-700 border-lime-200"
                            }
                          >
                            {template.category}
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      )}
                      {!selectMode && (
                        <Button
                          size="sm"
                          className={`w-full ${primaryBtnClass}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddToMenuDialog(template);
                          }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          Add to Menu
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <p className="text-sm font-medium">
            {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button size="sm" className={`${primaryBtnClass}`} onClick={openBulkAddDialog}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              Add to Menu
            </Button>
          </div>
        </div>
      )}

      {/* Save New Item(s) Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeAddDialog())}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save Items to Library</DialogTitle>
            <DialogDescription>
              Pick as many photos as you want at once, choose the category they all belong to, then adjust each
              name. Nothing here touches the live menu until you use "Add to Menu" later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={batchCategory} onValueChange={setBatchCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  {dbCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Applies to every photo you add below. Leave blank to save without one.</p>
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className={
                  isJaeky
                    ? "flex items-center justify-center gap-2 w-full h-20 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-purple-400 hover:text-purple-600 transition-colors"
                    : "flex items-center justify-center gap-2 w-full h-20 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-lime-400 hover:text-lime-600 transition-colors"
                }
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Select one or more photos</span>
              </button>
              <input
                ref={filesInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {batchItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {batchItems.map((item) => (
                  <div key={item.localId} className="relative border rounded-lg p-2 flex gap-2">
                    <button
                      onClick={() => handleRemoveBatchItem(item.localId)}
                      title="Remove"
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-16 h-16 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                      {item.processing ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : item.preview ? (
                        <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Input
                        value={item.name}
                        onChange={(e) => handleBatchNameChange(item.localId, e.target.value)}
                        placeholder="Item name"
                        className="h-8 text-xs"
                      />
                      <Textarea
                        value={item.description}
                        onChange={(e) => handleBatchDescriptionChange(item.localId, e.target.value)}
                        placeholder="Description (optional)"
                        rows={2}
                        className="text-xs resize-none min-h-0 py-1.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveBatch} disabled={submitting} className={`${primaryBtnClass}`}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save {batchItems.length > 0 ? `${batchItems.length} Item${batchItems.length === 1 ? "" : "s"}` : "Items"} to Library
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
              This creates a live, orderable menu item using the saved photo and description. Set a price and
              confirm the category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={addToMenuCategory} onValueChange={setAddToMenuCategory}>
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

            <div className="space-y-2">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAddToMenuDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToMenuConfirm}
              disabled={addingToMenu}
              className={`${primaryBtnClass}`}
            >
              {addingToMenu ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add to Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add to Menu Dialog */}
      <Dialog open={isBulkAddOpen} onOpenChange={(open) => !open && closeBulkAddDialog()}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Add {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} to the menu
            </DialogTitle>
            <DialogDescription>
              Every selected item gets this same category and price. You can adjust any of them individually on
              the Menu page afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
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

            <div className="space-y-2">
              <Label htmlFor="bulk-add-price">Price</Label>
              <Input
                id="bulk-add-price"
                type="number"
                min="0"
                step="0.01"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeBulkAddDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddConfirm}
              disabled={bulkAdding}
              className={`${primaryBtnClass}`}
            >
              {bulkAdding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add {selectedIds.size} Item{selectedIds.size === 1 ? "" : "s"}
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
