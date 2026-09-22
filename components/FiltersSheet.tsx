import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Category } from "@/lib/atlasRepository";
import { categories, categoryKeys } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function FiltersSheet({
  open,
  onOpenChange,
  filter,
  counts,
  total,
  visibleCount,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: Category | "all";
  counts: Record<Category, number>;
  total: number;
  visibleCount: number;
  onChange: (next: Category | "all") => void;
  onReset: () => void;
}) {
  const active = filter !== "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={
            active
              ? `Фильтры, выбрано: ${categories[filter].label}`
              : "Фильтры"
          }
        >
          <SlidersHorizontal />
          {active && (
            <span
              aria-hidden="true"
              className="bg-primary absolute -top-1 -right-1 size-2.5 rounded-full"
            />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription>
            Выберите категорию, чтобы оставить на карте только нужные места.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
            Категория
          </h3>
          {/*
            Chips wrap rather than sitting in one clipped scroller, so every
            label stays readable at any width or text size.
          */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className="rounded-full"
              aria-pressed={filter === "all"}
              onClick={() => onChange("all")}
            >
              Все места
              <Badge variant="secondary" className="tabular-nums">
                {total}
              </Badge>
            </Button>
            {categoryKeys.map((key) => {
              const { label, icon: CategoryIcon, color } = categories[key];
              const selected = filter === key;
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  className="rounded-full"
                  aria-pressed={selected}
                  onClick={() => onChange(key)}
                >
                  <CategoryIcon
                    style={{ color: selected ? undefined : color }}
                    aria-hidden="true"
                  />
                  {label}
                  <Badge variant="secondary" className="tabular-nums">
                    {counts[key]}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        <SheetFooter className={cn("border-t", "sm:flex-row sm:justify-between")}>
          <Button variant="ghost" onClick={onReset} disabled={!active}>
            Сбросить
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Показать {visibleCount}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
