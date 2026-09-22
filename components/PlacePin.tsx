import type { Place } from "@/lib/atlasRepository";
import { categories } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type LabelSide = "left" | "right";

// Russian needs three forms: 1 место, 2 места, 5 мест (and 21 место, 22 места).
const pluralRules = new Intl.PluralRules("ru");
const placesWord = (count: number) =>
  ({ one: "место", few: "места", many: "мест", other: "места" })[
    pluralRules.select(count) as "one" | "few" | "many" | "other"
  ];

/*
 * A pin is a 40px disc scaled to 80% (32px) at rest, so every size change is a
 * transform rather than a width or height animation. Selected, it returns to
 * full size, grows a tail and lifts 29px so the tail's tip sits on the
 * coordinate (measured in the browser, within a pixel);
 * at rest the disc itself is centred on it.
 *
 * The button is a 44px hit area around the smaller visual disc.
 */
export function PlacePin({
  place,
  selected,
  labelSide,
  hidden = false,
  clusterSize = 1,
  onSelect,
  onExpand,
  onFocus,
}: {
  place: Place;
  selected: boolean;
  /** Where layout placed the label, or null when there is no room for it. */
  labelSide: LabelSide | null;
  /** Absorbed into a neighbour's cluster: not drawn and not focusable. */
  hidden?: boolean;
  /** More than 1 turns this pin into a cluster of that many places. */
  clusterSize?: number;
  onSelect: () => void;
  onExpand?: () => void;
  /** Lets the map bring a pin reached by keyboard into view. */
  onFocus?: () => void;
}) {
  const { label, icon: CategoryIcon, color } = categories[place.category];

  if (hidden) return null;

  /*
   * A cluster mixes categories, so it is neutral and carries its count as
   * text; colour would only name one of the places inside.
   */
  if (clusterSize > 1) {
    return (
      <button
        type="button"
        className="place-marker group absolute top-0 left-0 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full outline-none"
        aria-label={`${clusterSize} ${placesWord(clusterSize)} рядом. Приблизить`}
        onFocus={onFocus}
        onClick={(event) => {
          event.stopPropagation();
          onExpand?.();
        }}
      >
        <span
          aria-hidden="true"
          className="bg-foreground text-background group-focus-visible:ring-ring/60 grid size-9 place-items-center rounded-full border-[3px] border-white text-sm font-semibold tabular-nums shadow-md transition-[scale] duration-150 ease-out group-hover:scale-110 group-focus-visible:ring-4"
        >
          {clusterSize}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="place-marker group absolute top-0 left-0 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full outline-none"
      aria-label={`${label}: ${place.name}`}
      aria-pressed={selected}
      onFocus={onFocus}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative grid size-10 place-items-center rounded-full border-[3px] border-white shadow-md transition-[scale,translate,box-shadow] duration-150 ease-out",
          "group-focus-visible:ring-ring/60 group-focus-visible:ring-4",
          selected
            ? "-translate-y-[29px] scale-100 shadow-lg"
            : "scale-80 group-hover:scale-90",
        )}
        style={{ backgroundColor: color }}
      >
        <CategoryIcon className="size-5 text-white [stroke-width:2]" />
        {selected && (
          <span
            className="absolute -bottom-[9px] left-1/2 -z-10 size-3.5 -translate-x-1/2 rotate-45 rounded-br-[3px] border-r-[3px] border-b-[3px] border-white"
            style={{ backgroundColor: color }}
          />
        )}
      </span>

      {/*
        A small plate rather than haloed text: on busy OSM tiles haloed text
        reads as one more street label, while the plate reads as ours.
        Hidden labels keep their width (opacity, not display) so the layout
        pass can measure them.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 h-5 max-w-40 -translate-y-1/2 truncate rounded-md border px-1.5 text-xs leading-[18px] font-medium whitespace-nowrap shadow-sm transition-opacity duration-150",
          labelSide === "left" && !selected ? "right-[calc(100%-4px)]" : "left-[calc(100%-4px)]",
          "place-marker-label",
          // Selected inverts the plate rather than bolding the text: bold
          // widened the label past max-w-40 and truncated the one name that
          // matters most.
          selected
            ? "bg-foreground text-background left-[calc(100%+2px)] -translate-y-[calc(50%+29px)] border-transparent"
            : "bg-background/95 text-foreground",
          labelSide || selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      >
        {place.name}
      </span>
    </button>
  );
}
