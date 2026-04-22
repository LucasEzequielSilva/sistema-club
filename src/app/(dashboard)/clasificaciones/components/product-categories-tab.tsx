"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc-client";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductCategoryDialog } from "./product-category-dialog";
import { ProductSubcategoryDialog } from "./product-subcategory-dialog";
import { toast } from "sonner";
import { Tag, MoreHorizontal, ChevronDown, ChevronRight, Plus } from "lucide-react";

interface ProductCategoriesTabProps {
  accountId: string;
}

type Subcategory = {
  id: string;
  accountId: string;
  categoryId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export function ProductCategoriesTab({
  accountId,
}: ProductCategoriesTabProps) {
  const [confirmDelete, ConfirmDeleteDialog] = useConfirm({
    title: "Eliminar",
    description: "Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    editingId: string | null;
  }>({ open: false, editingId: null });

  const [subDialog, setSubDialog] = useState<{
    open: boolean;
    categoryId: string;
    categoryName: string;
    initialData: Subcategory | null;
  }>({ open: false, categoryId: "", categoryName: "", initialData: null });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, subs] = await Promise.all([
        trpc.clasificaciones.listProductCategories.query({ accountId }),
        trpc.clasificaciones.listProductSubcategories.query({ accountId }),
      ]);
      setCategories(cats as Category[]);
      setSubcategories(subs as Subcategory[]);
    } catch (error) {
      toast.error("Error al cargar las clasificaciones");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [accountId]);

  const handleDeleteCategory = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.clasificaciones.deleteProductCategory.mutate({ id });
      toast.success("Categoría eliminada");
      void loadAll();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!(await confirmDelete())) return;
    try {
      await trpc.clasificaciones.deleteProductSubcategory.mutate({ id });
      toast.success("Subcategoría eliminada");
      void loadAll();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  const closeCategoryDialog = () =>
    setCategoryDialog({ open: false, editingId: null });
  const closeSubDialog = () =>
    setSubDialog({ open: false, categoryId: "", categoryName: "", initialData: null });

  const onCategorySaved = () => {
    closeCategoryDialog();
    void loadAll();
  };
  const onSubSaved = () => {
    closeSubDialog();
    void loadAll();
  };

  const toggleExpand = (categoryId: string) =>
    setExpanded((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));

  const subsByCategory = (categoryId: string) =>
    subcategories.filter((s) => s.categoryId === categoryId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pt-2">
        <p className="text-sm text-muted-foreground">
          {categories.length} categoría{categories.length !== 1 ? "s" : ""}
          {subcategories.length > 0 && ` · ${subcategories.length} subcategoría${subcategories.length !== 1 ? "s" : ""}`}
        </p>
        <Button onClick={() => setCategoryDialog({ open: true, editingId: null })}>
          + Nueva Categoría
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Sin categorías"
          description="Creá tu primera categoría de producto para comenzar"
          actionLabel="+ Nueva Categoría"
          onAction={() => setCategoryDialog({ open: true, editingId: null })}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden divide-y divide-border">
          {categories.map((cat) => {
            const subs = subsByCategory(cat.id);
            const isOpen = !!expanded[cat.id];
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.id)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    aria-label={isOpen ? "Contraer" : "Expandir"}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cat.name}</span>
                      {!cat.isActive && <Badge variant="secondary">Inactiva</Badge>}
                      {subs.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {subs.length} sub{subs.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      setSubDialog({
                        open: true,
                        categoryId: cat.id,
                        categoryName: cat.name,
                        initialData: null,
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Sub
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setCategoryDialog({ open: true, editingId: cat.id })}
                      >
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => void handleDeleteCategory(cat.id)}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isOpen && (
                  <div className="bg-muted/20 border-t border-border pl-10">
                    {subs.length === 0 ? (
                      <div className="py-3 text-xs text-muted-foreground">
                        Sin subcategorías. Usá <span className="font-medium">+ Sub</span> para crear una.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/60">
                        {subs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 py-2 pr-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{sub.name}</span>
                                {!sub.isActive && (
                                  <Badge variant="secondary" className="text-xs">Inactiva</Badge>
                                )}
                              </div>
                              {sub.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {sub.description}
                                </p>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setSubDialog({
                                      open: true,
                                      categoryId: cat.id,
                                      categoryName: cat.name,
                                      initialData: sub,
                                    })
                                  }
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => void handleDeleteSubcategory(sub.id)}
                                >
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProductCategoryDialog
        open={categoryDialog.open}
        onOpenChange={(open) =>
          setCategoryDialog((prev) => ({ ...prev, open }))
        }
        onClose={closeCategoryDialog}
        onSuccess={onCategorySaved}
        accountId={accountId}
        editingId={categoryDialog.editingId}
      />

      <ProductSubcategoryDialog
        open={subDialog.open}
        onOpenChange={(open) =>
          setSubDialog((prev) => ({ ...prev, open }))
        }
        onClose={closeSubDialog}
        onSuccess={onSubSaved}
        accountId={accountId}
        categoryId={subDialog.categoryId}
        categoryName={subDialog.categoryName}
        initialData={subDialog.initialData}
      />

      {ConfirmDeleteDialog}
    </div>
  );
}
