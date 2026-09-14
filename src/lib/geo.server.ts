/**
 * Google Geocoding + Places (New) via the connector gateway — server-only.
 * The managed browser key is referrer-locked to *.lovable.app, so every
 * Google call in this app runs here, server-side, where it also works on
 * the custom domain.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type NearbyBusiness = {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  primaryType: string;
};

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  addressComponents?: AddressComponent[];
};

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Maps connector is not configured");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    ...extra,
  };
}

function denied(status: number, body: unknown): Error {
  const details: Array<{ reason?: string }> =
    (body as { error?: { details?: Array<{ reason?: string }> } })?.error?.details ?? [];
  const reason = details.find((d) => d.reason)?.reason;
  if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
    return new Error(
      'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
    );
  }
  if (reason === "API_KEY_SERVICE_BLOCKED") {
    return new Error(
      "Google Maps server key does not allow this API. In Google Cloud Console, add it to the server key's allowed-APIs list.",
    );
  }
  return new Error(`Google Maps request was denied (${status}). Check the Maps key restrictions.`);
}

function component(components: AddressComponent[], type: string, short = false): string {
  const c = components.find((x) => x.types?.includes(type));
  return (short ? c?.shortText : c?.longText) ?? "";
}

function toBusiness(p: Place): NearbyBusiness | null {
  const name = p.displayName?.text?.trim();
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (!name || !p.id || typeof lat !== "number" || typeof lng !== "number") return null;
  const comps = p.addressComponents ?? [];
  const street = [component(comps, "street_number"), component(comps, "route")]
    .filter(Boolean)
    .join(" ");
  return {
    placeId: p.id,
    name,
    address: p.formattedAddress ?? "",
    phone: p.nationalPhoneNumber ?? "",
    lat,
    lng,
    addressLine1: street,
    city: component(comps, "locality") || component(comps, "postal_town"),
    state: component(comps, "administrative_area_level_1", true),
    postalCode: component(comps, "postal_code"),
    primaryType: p.primaryTypeDisplayName?.text ?? "",
  };
}

const PLACE_FIELDS =
  "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.location,places.addressComponents,places.primaryTypeDisplayName";

/** Businesses around a point. Radius is capped and results bounded to keep Maps spend predictable. */
/**
 * Merchant-relevant place types, grouped so each group is one Places call.
 * Google caps a single Nearby Search at 20 results, which is why one plain
 * call misses most of what google.com/maps shows. Fanning out across
 * category groups (bounded, deduped) gives far denser coverage while
 * keeping Maps spend predictable.
 */
const TYPE_GROUPS: string[][] = [
  ["restaurant", "cafe", "bakery", "meal_takeaway"],
  ["bar", "liquor_store", "night_club"],
  ["convenience_store", "grocery_store", "supermarket", "gas_station"],
  ["clothing_store", "shoe_store", "jewelry_store", "furniture_store", "book_store"],
  ["hair_care", "beauty_salon", "nail_salon", "spa", "gym"],
  ["car_repair", "car_wash", "hardware_store", "pet_store", "florist", "pharmacy"],
];

type SearchResponse = { places?: Place[]; nextPageToken?: string };

async function placesCall(
  path: string,
  body: unknown,
  fieldMask = PLACE_FIELDS,
): Promise<SearchResponse> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/json",
      "X-Goog-FieldMask": fieldMask,
    }),
    body: JSON.stringify(body),
  });

  if (response.status === 403) throw denied(403, await response.json().catch(() => null));
  if (!response.ok) {
    const text = await response.text();
    console.error(`Places search failed [${response.status}]: ${text}`);
    throw new Error(`Business search failed (${response.status})`);
  }
  return (await response.json()) as SearchResponse;
}

export async function searchNearbyBusinesses(opts: {
  lat: number;
  lng: number;
  radiusMeters: number;
  keyword?: string;
}): Promise<NearbyBusiness[]> {
  const radius = Math.min(Math.max(opts.radiusMeters, 100), 20000);
  const keyword = opts.keyword?.trim();
  const circle = { center: { latitude: opts.lat, longitude: opts.lng }, radius };
  const responses: SearchResponse[] = [];

  if (keyword) {
    // Text search: walk up to 3 pages (60 results) for the typed query.
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const res = await placesCall("/places/v1/places:searchText", {
        textQuery: keyword,
        pageSize: 20,
        languageCode: "en",
        locationBias: { circle },
        ...(pageToken ? { pageToken } : {}),
      }, `${PLACE_FIELDS},nextPageToken`);
      responses.push(res);
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }
  } else {
    // Browse mode: one bounded call per category group, run in parallel.
    const calls = TYPE_GROUPS.map((includedTypes) =>
      placesCall("/places/v1/places:searchNearby", {
        maxResultCount: 20,
        languageCode: "en",
        includedTypes,
        rankPreference: "DISTANCE",
        locationRestriction: { circle },
      }),
    );
    const settled = await Promise.allSettled(calls);
    const firstError = settled.find((s) => s.status === "rejected");
    if (settled.every((s) => s.status === "rejected") && firstError?.status === "rejected") {
      throw firstError.reason as Error;
    }
    for (const s of settled) if (s.status === "fulfilled") responses.push(s.value);
  }

  const seen = new Set<string>();
  const out: NearbyBusiness[] = [];
  for (const res of responses) {
    for (const place of res.places ?? []) {
      const business = toBusiness(place);
      if (!business || seen.has(business.placeId)) continue;
      seen.add(business.placeId);
      out.push(business);
    }
  }

  // Closest first so the list mirrors what the rep sees on screen.
  const dist = (b: NearbyBusiness) =>
    (b.lat - opts.lat) ** 2 + ((b.lng - opts.lng) * Math.cos((opts.lat * Math.PI) / 180)) ** 2;
  return out.sort((a, b) => dist(a) - dist(b));
}



export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

/** Address string → coordinates. Returns null when Google can't place it. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (trimmed.length < 4) return null;

  const response = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}`,
    { headers: gatewayHeaders() },
  );

  if (response.status === 403) throw denied(403, await response.json().catch(() => null));
  if (!response.ok) {
    const text = await response.text();
    console.error(`Geocode failed [${response.status}]: ${text}`);
    throw new Error(`Address lookup failed (${response.status})`);
  }

  const data = (await response.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };

  const first = data.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng, formattedAddress: first?.formatted_address ?? trimmed };
}

/** Builds the one-line address we hand to Google from lead columns. */
export function composeAddress(parts: {
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string {
  return [parts.address_line1, parts.city, parts.state, parts.postal_code]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

export type AddressSuggestion = { placeId: string; primary: string; secondary: string };

/** Address autocomplete (Places New). Bounded pageSize keeps Maps spend predictable. */
export async function autocompleteAddresses(input: string): Promise<AddressSuggestion[]> {
  const query = input.trim();
  if (query.length < 3) return [];

  const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
    method: "POST",
    headers: gatewayHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ input: query, languageCode: "en", includedRegionCodes: ["us"] }),
  });

  if (response.status === 403) throw denied(403, await response.json().catch(() => null));
  if (!response.ok) {
    const text = await response.text();
    console.error(`Places autocomplete failed [${response.status}]: ${text}`);
    throw new Error(`Address lookup failed (${response.status})`);
  }

  const data = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }>;
  };

  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .slice(0, 8)
    .map((p) => ({
      placeId: p.placeId as string,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export type PlaceAddress = {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

/** Full address parts for a place the user picked from autocomplete. */
export async function placeAddress(placeId: string): Promise<PlaceAddress | null> {
  const response = await fetch(
    `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: gatewayHeaders({
        "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
      }),
    },
  );

  if (response.status === 403) throw denied(403, await response.json().catch(() => null));
  if (!response.ok) {
    const text = await response.text();
    console.error(`Place details failed [${response.status}]: ${text}`);
    throw new Error(`Address lookup failed (${response.status})`);
  }

  const p = (await response.json()) as Place;
  const comps = p.addressComponents ?? [];
  const street = [component(comps, "street_number"), component(comps, "route")]
    .filter(Boolean)
    .join(" ");
  return {
    formattedAddress: p.formattedAddress ?? "",
    addressLine1: street || (p.formattedAddress ?? "").split(",")[0] || "",
    city: component(comps, "locality") || component(comps, "postal_town"),
    state: component(comps, "administrative_area_level_1", true),
    postalCode: component(comps, "postal_code"),
    lat: typeof p.location?.latitude === "number" ? p.location.latitude : null,
    lng: typeof p.location?.longitude === "number" ? p.location.longitude : null,
  };
}
