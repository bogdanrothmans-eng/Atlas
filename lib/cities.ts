export type City = {
  id: string;
  name: string;
  country: string;
  lng: number;
  lat: number;
  zoom: number;
  /** Places within this radius of the centre belong to the city. */
  radiusKm: number;
};

/*
 * The places table stores coordinates but no city, so a city is a centre plus
 * a radius and membership is computed from the place's own coordinates. Adding
 * a city here is enough to make it selectable.
 */
export const cities: City[] = [
  { id: "phuket", name: "Пхукет", country: "Таиланд", lng: 98.365, lat: 7.86, zoom: 10.7, radiusKm: 45 },
  { id: "bangkok", name: "Бангкок", country: "Таиланд", lng: 100.5018, lat: 13.7563, zoom: 10.5, radiusKm: 45 },
  { id: "denpasar", name: "Денпасар", country: "Индонезия", lng: 115.2126, lat: -8.6705, zoom: 10.5, radiusKm: 50 },
  { id: "tbilisi", name: "Тбилиси", country: "Грузия", lng: 44.7833, lat: 41.7151, zoom: 11, radiusKm: 30 },
  { id: "yerevan", name: "Ереван", country: "Армения", lng: 44.5152, lat: 40.1872, zoom: 11, radiusKm: 30 },
  { id: "istanbul", name: "Стамбул", country: "Турция", lng: 28.9784, lat: 41.0082, zoom: 10, radiusKm: 55 },
  { id: "belgrade", name: "Белград", country: "Сербия", lng: 20.4489, lat: 44.7866, zoom: 11, radiusKm: 30 },
];

export const defaultCity = cities[0];

export const cityById = (id: string) =>
  cities.find((city) => city.id === id) ?? defaultCity;

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const isInCity = (place: { lng: number; lat: number }, city: City) =>
  distanceKm(place, city) <= city.radiusKm;
