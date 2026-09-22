import { useMemo, useState } from "react";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cities, type City } from "@/lib/cities";
import { cn } from "@/lib/utils";

export function CitySwitcher({
  city,
  counts,
  onSelect,
}: {
  city: City;
  counts: Record<string, number>;
  onSelect: (city: City) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cities;
    return cities.filter((item) =>
      `${item.name} ${item.country}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  const choose = (next: City) => {
    onSelect(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1.5 px-2"
          aria-label={`Город: ${city.name}, ${city.country}. Выбрать другой`}
        >
          {/*
            One line only. A second muted line sat at 4.34:1 against the ghost
            button's hover surface, and the country reads fine in the list.
          */}
          <MapPin className="text-muted-foreground" />
          <span className="text-sm font-medium">{city.name}</span>
          <ChevronDown
            className={cn(
              "text-muted-foreground transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 overflow-hidden p-0">
        <div className="relative border-b p-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Label className="sr-only" htmlFor="city-search">
            Поиск города
          </Label>
          <Input
            id="city-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти город"
            className="border-0 pl-9 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {matches.length ? (
            <ul className="p-1">
              {matches.map((item) => {
                const count = counts[item.id] ?? 0;
                const active = item.id === city.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      aria-current={active ? "true" : undefined}
                      className="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left outline-none focus-visible:ring-[3px]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.country}
                        </span>
                      </span>
                      <Badge variant="secondary" className="tabular-nums">
                        {count}
                      </Badge>
                      {active && <Check className="size-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground p-4 text-center text-sm">
              Город не найден
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
