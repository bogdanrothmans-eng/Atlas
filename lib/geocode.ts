type NominatimAddress = Partial<Record<
  | "road" | "pedestrian" | "footway" | "path" | "square"
  | "house_number" | "neighbourhood" | "quarter" | "suburb"
  | "village" | "town" | "city" | "hamlet",
  string
>>;

export const formatCoordinates = (lat: number, lng: number) =>
  `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/*
 * Street and house number for a point, or null when OpenStreetMap has nothing
 * useful there. Nominatim's public instance allows about one request a second;
 * Atlas asks once per new place, and the browser sends the site as Referer,
 * which its usage policy requires.
 */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "18",
    addressdetails: "1",
    // Russian where OpenStreetMap has it, then English rather than local script.
    "accept-language": "ru,en",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal });
  if (!response.ok) return null;
  const { address } = (await response.json()) as { address?: NominatimAddress };
  if (!address) return null;

  const street = address.road ?? address.pedestrian ?? address.square ?? address.footway ?? address.path;
  if (street) return address.house_number ? `${street}, ${address.house_number}` : street;
  // No street nearby: the district still tells people where to look.
  return address.neighbourhood ?? address.quarter ?? address.suburb ?? address.village ?? address.hamlet ?? null;
}
