"use client";

// Step-by-step "Add Items" flow, one screen at a time like flash cards:
//   1. Add photos   2. Pick a category   3. Name & price   4. Done
// Admins land here right after logging in. Every other page (orders, menu,
// item library, users…) is one tap away under "More" — nothing was removed.
// Saves straight to the live menu through /api/menu-items, the same as the
// Menu page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import {
  ArrowLeft,
  Check,
  FolderOpen,
  ImagePlus,
  Loader2,
  Menu as MenuIcon,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useBrand } from "@/lib/use-brand";
import {
  MAX_FILE_BYTES,
  MIN_DIMENSION,
  isImageFile,
  looksLikeFilenameId,
  nameFromFileName,
  processImageFile,
} from "@/lib/process-image";

type Step = "upload" | "category" | "price" | "done";

interface DraftItem {
  id: number;
  fileName: string;
  name: string;
  price: string;
  image: string | null;
  status: "processing" | "ready" | "error";
}

interface DbCategory {
  id: string;
  name: string;
  hidden: boolean;
  order: number;
}

const STEPS: Step[] = ["upload", "category", "price", "done"];

const STEP_TITLE: Record<Step, string> = {
  upload: "Add photos",
  category: "Pick a category",
  price: "Name & price",
  done: "Done!",
};

// Everything that used to be on the dashboard, kept one tap away.
const MORE_LINKS = [
  { title: "Dashboard", url: "/dashboard" },
  { title: "New Order", url: "/dashboard/new-order" },
  { title: "All Orders", url: "/dashboard/all-orders" },
  { title: "Menu Prices", url: "/dashboard/menu-prices" },
  { title: "Menu", url: "/dashboard/menu" },
  { title: "Item Library", url: "/dashboard/item-library" },
  { title: "Users Management", url: "/dashboard/users-management" },
  { title: "Guest Ordering", url: "/place-new-order" },
];

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

// Tailwind needs full literal class names, so each brand's palette is
// spelled out rather than built from a color variable.
const PALETTES = {
  jaeky: {
    brand: "text-purple-700",
    primary: "bg-purple-700 text-white hover:bg-purple-800",
    bar: "bg-purple-600",
    drop: "border-purple-300 bg-purple-50 text-purple-900 hover:bg-purple-100",
    dropIcon: "bg-purple-700 text-white",
    selected: "border-purple-600 bg-purple-50",
    check: "bg-purple-700 text-white",
    soft: "bg-purple-100 text-purple-700",
    focus: "focus-visible:ring-purple-500",
  },
  vipservice4u: {
    brand: "text-lime-800",
    primary: "bg-lime-700 text-white hover:bg-lime-800",
    bar: "bg-lime-600",
    drop: "border-lime-300 bg-lime-50 text-lime-900 hover:bg-lime-100",
    dropIcon: "bg-lime-700 text-white",
    selected: "border-lime-600 bg-lime-50",
    check: "bg-lime-700 text-white",
    soft: "bg-lime-100 text-lime-800",
    focus: "focus-visible:ring-lime-500",
  },
} as const;

export default function QuickAddPage() {
  const brand = useBrand();
  const c = PALETTES[brand.site];

  const [step, setStep] = useState<Step>("upload");
  const [items, setItems] = useState<DraftItem[]>([]);
  const nextId = useRef(1);
  // Phones can't pick folders, so the folder button only shows on a
  // computer (a real mouse/trackpad). Starts hidden to match the server.
  const [isComputer, setIsComputer] = useState(false);

  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [itemCategories, setItemCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // "Same price for all": typing here fills every item's price at once.
  // Any single price can still be changed afterwards.
  const [priceForAll, setPriceForAll] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saved, setSaved] = useState<DraftItem[]>([]);
  // How many of the saved items were new to the Item Library this time.
  const [libraryAdded, setLibraryAdded] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsComputer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // React's input types don't include the non-standard folder-picker
  // attribute, so set it directly on the element when it appears.
  const folderInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, itemRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/menu-items?admin=true"),
        ]);
        if (catRes.ok) setDbCategories(await catRes.json());
        if (itemRes.ok) {
          const menuItems: { category?: string | null }[] = await itemRes.json();
          setItemCategories(
            menuItems.map((m) => (m.category || "").trim().toUpperCase()).filter(Boolean)
          );
        }
      } catch (err) {
        console.error("Error loading categories:", err);
        toast.error("Couldn't load your categories", {
          description: "You can still make a new one.",
        });
      } finally {
        setCategoriesLoading(false);
      }
    };
    load();
  }, []);

  // Registered categories first (in their saved order), then any category
  // that only exists on items. Hidden categories are left out, same as the
  // ordering screens.
  const categoryOptions = useMemo(() => {
    const hidden = new Set(dbCategories.filter((d) => d.hidden).map((d) => d.name));
    const names: string[] = [];
    [...dbCategories]
      .sort((a, b) => a.order - b.order)
      .forEach((d) => {
        if (!d.hidden && !names.includes(d.name)) names.push(d.name);
      });
    [...itemCategories].sort().forEach((n) => {
      if (!hidden.has(n) && !names.includes(n)) names.push(n);
    });
    if (category && !names.includes(category)) names.push(category);
    return names;
  }, [dbCategories, itemCategories, category]);

  const readyItems = items.filter((i) => i.status === "ready");
  const processingCount = items.filter((i) => i.status === "processing").length;
  const stepIndex = STEPS.indexOf(step);

  const updateItem = (id: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const accepted: { id: number; file: File }[] = [];
    let skippedType = 0;
    let skippedSize = 0;

    for (const file of files) {
      if (!isImageFile(file)) {
        skippedType++;
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        skippedSize++;
        continue;
      }
      accepted.push({ id: nextId.current++, file });
    }

    if (skippedType) {
      toast.message(`Skipped ${skippedType} file${skippedType > 1 ? "s" : ""}`, {
        description: "Only photos can be added.",
      });
    }
    if (skippedSize) {
      toast.error(`Skipped ${skippedSize} photo${skippedSize > 1 ? "s" : ""} over 25MB`);
    }
    if (accepted.length === 0) return;

    setItems((prev) => [
      ...prev,
      ...accepted.map(({ id, file }) => ({
        id,
        fileName: file.name,
        name: nameFromFileName(file.name),
        price: "",
        image: null,
        status: "processing" as const,
      })),
    ]);

    // One at a time so a big folder doesn't freeze the phone.
    let lowRes = 0;
    for (const { id, file } of accepted) {
      try {
        const { dataUrl, width, height } = await processImageFile(file);
        if (Math.min(width, height) < MIN_DIMENSION) lowRes++;
        updateItem(id, { image: dataUrl, status: "ready" });
      } catch (err) {
        console.error("Error processing image:", err);
        updateItem(id, { status: "error" });
        toast.error(`Couldn't read "${file.name}"`);
      }
    }
    if (lowRes) {
      toast.warning(`${lowRes} photo${lowRes > 1 ? "s are" : " is"} a bit small`, {
        description: "We sharpened them, but bigger photos look best on the menu.",
      });
    }
  };

  const removeItem = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  const confirmNewCategory = () => {
    const name = newCategoryName.trim().toUpperCase();
    if (!name) return;
    setCategory(name);
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const priceProblem = (item: DraftItem) => {
    if (!item.name.trim()) return "Add a name";
    if (looksLikeFilenameId(item.name.trim())) return "Type a real name";
    if (item.price === "" || Number.isNaN(Number(item.price)) || Number(item.price) <= 0) return "Add a price";
    return null;
  };
  const allPricesOk = readyItems.length > 0 && readyItems.every((i) => !priceProblem(i));

  const handleSave = async () => {
    if (!category || !allPricesOk || saving) return;
    setSaving(true);
    setSaveProgress(0);

    // A brand-new category gets its own row, like the Menu page does.
    // A 409 just means it already exists.
    if (!dbCategories.some((d) => d.name === category)) {
      try {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: category }),
        });
        if (res.ok) {
          const created: DbCategory = await res.json();
          setDbCategories((prev) => [...prev, created]);
        }
      } catch (err) {
        console.error("Error registering category:", err);
      }
    }

    // Every new item also goes into the Item Library so its photo can be
    // reused after a wash-up — unless the library already has an item with
    // the same name (any capitalization), so nothing gets saved twice.
    const nameKey = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
    const libraryNames = new Set<string>();
    try {
      const res = await fetch("/api/menu-templates");
      if (res.ok) {
        const templates: { name?: string | null }[] = await res.json();
        templates.forEach((t) => t.name && libraryNames.add(nameKey(t.name)));
      }
    } catch (err) {
      console.error("Error loading item library:", err);
    }
    let addedToLibrary = 0;

    const done: DraftItem[] = [];
    const failed: DraftItem[] = [];
    let firstFailReason = "";

    for (const item of readyItems) {
      try {
        const res = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name.trim(),
            description: null,
            price: Math.round(Number(item.price) * 100) / 100,
            image: item.image,
            category,
            available: true,
          }),
        });
        if (!res.ok) {
          // Turn the server's answer into words a person can act on.
          let reason = "";
          if (res.status === 413) {
            reason = "The photo is too large to send. Try a smaller photo.";
          } else {
            try {
              const data = await res.json();
              reason = [data?.error, data?.detail].filter(Boolean).join(" — ");
            } catch {
              reason = "";
            }
          }
          throw new Error(reason || `The server said no (error ${res.status}).`);
        }
        done.push(item);

        // Best effort: the menu item is what matters.
        const key = nameKey(item.name);
        if (!libraryNames.has(key)) {
          libraryNames.add(key);
          try {
            const libRes = await fetch("/api/menu-templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: item.name.trim(), image: item.image, category }),
            });
            if (libRes.ok) addedToLibrary++;
          } catch (err) {
            console.error("Error saving to item library:", err);
          }
        }
      } catch (err) {
        console.error("Error saving menu item:", err);
        failed.push(item);
        if (!firstFailReason) {
          firstFailReason = `${item.name.trim()}: ${
            err instanceof Error && err.message ? err.message : "couldn't reach the server"
          }`;
        }
      }
      setSaveProgress((p) => p + 1);
    }

    setSaving(false);
    setSaved((prev) => [...prev, ...done]);
    setLibraryAdded((prev) => prev + addedToLibrary);

    if (failed.length) {
      // Keep only the ones that didn't save so they can be retried.
      setItems((prev) => prev.filter((i) => failed.some((f) => f.id === i.id)));
      toast.error(`${failed.length} item${failed.length > 1 ? "s" : ""} didn't save`, {
        description: `${firstFailReason}${
          done.length ? ` (${done.length} other${done.length === 1 ? "" : "s"} saved.)` : ""
        }`,
        duration: 15000,
      });
      return;
    }

    setItems([]);
    setStep("done");
  };

  const startOver = () => {
    setItems([]);
    setSaved([]);
    setLibraryAdded(0);
    setCategory(null);
    setPriceForAll("");
    setStep("upload");
  };

  const cleanPrice = (raw: string) => raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  const applyPriceForAll = (raw: string) => {
    const price = cleanPrice(raw);
    setPriceForAll(price);
    setItems((prev) => prev.map((i) => (i.status === "ready" ? { ...i, price } : i)));
  };

  const goBack = () => {
    if (step === "category") setStep("upload");
    if (step === "price") setStep("category");
  };

  const primaryBtn = `flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 ${c.primary} ${c.focus}`;
  const fieldCls = `h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline-none focus-visible:ring-2 ${c.focus}`;

  return (
    <div className="flex h-dvh flex-col bg-zinc-50 text-zinc-900">
      {/* Top: brand, More, and where you are */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className={`flex items-center gap-2 text-sm font-semibold tracking-widest uppercase ${c.brand}`}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {brand.name}
            </span>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 ${c.focus}`}
            >
              <MenuIcon className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </div>

          <div className="flex items-center gap-3">
            {(step === "category" || step === "price") && (
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                aria-label="Back"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 ${c.focus}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-sm font-medium text-zinc-600">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              <div className="flex gap-1.5" aria-hidden="true">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? c.bar : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The card for this step */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5 py-6">
          <h1 className="text-3xl font-bold tracking-tight">{STEP_TITLE[step]}</h1>

          {/* STEP 1: PHOTOS */}
          {step === "upload" && (
            <>
              <p className="-mt-3 text-base text-zinc-600">
                {isComputer ? "Pick one photo, a few, or a whole folder." : "Pick one photo or a bunch at once."}
              </p>

              <label
                className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition-colors focus-within:ring-4 ${c.drop} ${c.focus}`}
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${c.dropIcon}`}>
                  <ImagePlus className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="text-lg font-semibold">Choose photos</span>
                <span className="text-sm">We&apos;ll make them all the same size and look</span>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {isComputer && (
                <label
                  className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white text-base font-semibold text-zinc-700 hover:bg-zinc-50 focus-within:ring-4 ${c.focus}`}
                >
                  <FolderOpen className="h-5 w-5" aria-hidden="true" />
                  Choose a whole folder
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {items.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-semibold text-zinc-700">
                    {readyItems.length} photo{readyItems.length === 1 ? "" : "s"} ready
                    {processingCount > 0 && ` · ${processingCount} getting ready…`}
                  </span>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {items.map((item) => (
                      <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name || item.fileName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-500">
                            {item.status === "error" ? (
                              <span className="px-2 text-center text-xs">Couldn&apos;t read</span>
                            ) : (
                              <Loader2 className="h-6 w-6 animate-spin" />
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.name || item.fileName}`}
                          className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/75 text-white hover:bg-zinc-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: CATEGORY */}
          {step === "category" && (
            <>
              <p className="-mt-3 text-base text-zinc-600">
                {readyItems.length === 1
                  ? "Where should this item go?"
                  : `All ${readyItems.length} items will go here.`}
              </p>

              {categoriesLoading ? (
                <div className="flex items-center gap-2 text-zinc-600">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading categories…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {categoryOptions.map((name) => {
                    const isSelected = category === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setCategory(name)}
                        className={`relative flex h-24 items-end rounded-2xl border-2 p-4 text-left text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 ${c.focus} ${
                          isSelected ? c.selected : "border-zinc-200 bg-white hover:border-zinc-300"
                        }`}
                      >
                        <span className="line-clamp-2">{titleCase(name)}</span>
                        {isSelected && (
                          <span className={`absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full ${c.check}`}>
                            <Check className="h-4 w-4" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {!addingCategory ? (
                    <button
                      type="button"
                      onClick={() => setAddingCategory(true)}
                      className={`flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 bg-white text-base font-semibold text-zinc-600 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-4 ${c.focus}`}
                    >
                      <Plus className="h-5 w-5" aria-hidden="true" />
                      New category
                    </button>
                  ) : (
                    <div className="col-span-2 flex flex-col gap-2 rounded-2xl border-2 border-zinc-200 bg-white p-4">
                      <label htmlFor="new-category" className="text-sm font-medium text-zinc-700">
                        New category name
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="new-category"
                          autoFocus
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmNewCategory();
                          }}
                          placeholder="e.g. Desserts"
                          className={fieldCls}
                        />
                        <button
                          type="button"
                          onClick={confirmNewCategory}
                          disabled={!newCategoryName.trim()}
                          className={`h-12 shrink-0 rounded-xl px-5 font-semibold disabled:opacity-40 ${c.primary}`}
                        >
                          Add
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCategory(false);
                          setNewCategoryName("");
                        }}
                        className="self-start py-2 text-sm font-medium text-zinc-600 underline underline-offset-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 3: NAME & PRICE */}
          {step === "price" && (
            <>
              <p className="-mt-3 text-base text-zinc-600">
                Going into{" "}
                <span className={`rounded-md px-2 py-0.5 font-semibold ${c.soft}`}>
                  {category ? titleCase(category) : ""}
                </span>
              </p>

              {readyItems.length > 1 && (
                <div className={`flex flex-col gap-2 rounded-2xl border-2 p-4 ${c.selected}`}>
                  <label htmlFor="price-for-all" className="text-base font-semibold text-zinc-900">
                    Same price for all {readyItems.length}?
                  </label>
                  <span
                    className={`flex h-14 items-center gap-1 rounded-xl border border-zinc-300 bg-white px-4 focus-within:ring-2 ${c.focus}`}
                  >
                    <span className="text-lg text-zinc-500">$</span>
                    <input
                      id="price-for-all"
                      inputMode="decimal"
                      value={priceForAll}
                      onChange={(e) => applyPriceForAll(e.target.value)}
                      placeholder="0.00"
                      className="h-12 min-w-0 flex-1 bg-transparent text-lg text-zinc-900 focus:outline-none"
                    />
                  </span>
                  <span className="text-sm text-zinc-600">
                    Type it once and every item gets it. You can still change one below.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {readyItems.map((item) => {
                  const problem = priceProblem(item);
                  return (
                    <div key={item.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || ""}
                        alt=""
                        className="h-24 w-24 shrink-0 rounded-xl bg-zinc-200 object-cover"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                          Item name
                          <input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder="Type a name"
                            className={fieldCls}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                          Price
                          <span
                            className={`flex h-12 items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 focus-within:ring-2 ${c.focus}`}
                          >
                            <span className="text-base text-zinc-500">$</span>
                            <input
                              inputMode="decimal"
                              value={item.price}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  price: e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"),
                                })
                              }
                              placeholder="0.00"
                              className="h-10 min-w-0 flex-1 bg-transparent text-base text-zinc-900 focus:outline-none"
                            />
                          </span>
                        </label>
                        {problem && (item.name || item.price) && (
                          <span className="text-xs font-medium text-amber-800">{problem}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 4: DONE */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 pt-2 text-center">
              <span className={`flex h-20 w-20 items-center justify-center rounded-full ${c.soft}`}>
                <Check className="h-10 w-10" strokeWidth={2.5} />
              </span>
              <p className="text-lg text-zinc-700">
                {saved.length} item{saved.length === 1 ? "" : "s"} added to{" "}
                <span className="font-semibold text-zinc-900">{category ? titleCase(category) : "the menu"}</span>
                {" "}and showing on the menu now.
              </p>
              <p className="-mt-2 text-sm text-zinc-600">
                {libraryAdded > 0
                  ? `${libraryAdded} new photo${libraryAdded === 1 ? "" : "s"} saved to your Item Library.`
                  : "Already in your Item Library, so nothing new was saved there."}
              </p>
              <div className="grid w-full grid-cols-4 gap-2">
                {saved.map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.id}
                    src={item.image || ""}
                    alt={item.name}
                    className="aspect-square w-full rounded-xl bg-zinc-200 object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* One big button at the bottom */}
      <div className="border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-5 py-4">
          {step === "upload" && (
            <button
              type="button"
              className={primaryBtn}
              disabled={readyItems.length === 0 || processingCount > 0}
              onClick={() => setStep("category")}
            >
              {processingCount > 0 ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Getting photos ready…
                </>
              ) : (
                "Next"
              )}
            </button>
          )}
          {step === "category" && (
            <button type="button" className={primaryBtn} disabled={!category} onClick={() => setStep("price")}>
              Next
            </button>
          )}
          {step === "price" && (
            <button type="button" className={primaryBtn} disabled={!allPricesOk || saving} onClick={handleSave}>
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Saving {Math.min(saveProgress + 1, readyItems.length)} of{" "}
                  {readyItems.length}…
                </>
              ) : (
                "Save to menu"
              )}
            </button>
          )}
          {step === "done" && (
            <>
              {/* Done takes you back to the dashboard. Log out is still in
                  the More menu at the top. */}
              <a href="/dashboard" className={primaryBtn}>
                Done
              </a>
              <button
                type="button"
                onClick={startOver}
                className={`flex h-12 w-full items-center justify-center rounded-2xl border border-zinc-300 bg-white text-base font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 ${c.focus}`}
              >
                Add more
              </button>
            </>
          )}
        </div>
      </div>

      {/* More: every other page, nothing removed */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Everything else</SheetTitle>
            <SheetDescription>Orders, menu, users and the rest.</SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col px-2">
            {MORE_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                className="flex min-h-12 items-center rounded-xl px-3 text-base font-medium text-zinc-900 hover:bg-zinc-100"
              >
                {link.title}
              </a>
            ))}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex min-h-12 items-center rounded-xl px-3 text-left text-base font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Log out
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
