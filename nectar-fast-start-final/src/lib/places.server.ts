/**
 * Google Places API (New) via the connector gateway — server-only helpers.
 * Kept out of *.functions.ts so those stay thin wrappers.
 */

export type BusinessResult = {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  city: string;
  state: string;
  postalCode: string;
  addressLine1: string;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  addressComponents?: AddressComponent[];
};

function component(components: AddressComponent[], type: string, short = false): string {
  const c = components.find((x) => x.types?.includes(type));
  return (short ? c?.shortText : c?.longText) ?? "";
}

function toResult(p: Place): BusinessResult | null {
  const name = p.displayName?.text?.trim();
  if (!name || !p.id) return null;
  const comps = p.addressComponents ?? [];
  const street = [component(comps, "street_number"), component(comps, "route")]
    .filter(Boolean)
    .join(" ");
  return {
    placeId: p.id,
    name,
    address: p.formattedAddress ?? "",
    phone: p.nationalPhoneNumber ?? "",
    city: component(comps, "locality") || component(comps, "postal_town"),
    state: component(comps, "administrative_area_level_1", true),
    postalCode: component(comps, "postal_code"),
    addressLine1: street,
  };
}

export async function searchBusinessesOnGoogle(query: string): Promise<BusinessResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Maps connector is not configured");
  }

  const response = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 5,
      languageCode: "en",
    }),
  });

  if (response.status === 403) {
    const details: Array<{ reason?: string }> =
      (await response.json().catch(() => null))?.error?.details ?? [];
    const reason = details.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error(
        'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
      );
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error(
        "Google Maps server key does not allow the Places API. In Google Cloud Console, add Places API (New) to the server key's allowed-APIs list.",
      );
    }
    throw new Error("Google Places request was denied (403). Check the Maps key restrictions.");
  }
  if (!response.ok) {
    const body = await response.text();
    console.error(`Places searchText failed [${response.status}]: ${body}`);
    throw new Error(`Business search failed (${response.status})`);
  }

  const data = (await response.json()) as { places?: Place[] };
  return (data.places ?? [])
    .map(toResult)
    .filter((r): r is BusinessResult => r !== null)
    .slice(0, 5);
}
