export type DeliveryAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: "US";
};

/** Lower 48 states, plus the District of Columbia. Alaska and Hawaii are excluded. */
export const CONTIGUOUS_STATES: readonly (readonly [string, string])[] = [
  ["AL", "Alabama"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

const STATE_CODES = new Set(CONTIGUOUS_STATES.map(([code]) => code));

/** ZIP prefixes for Alaska, Hawaii, and U.S. territories. */
const NON_CONTIGUOUS_ZIPS = new Set([
  "006",
  "007",
  "008",
  "009",
  "967",
  "968",
  "969",
  "995",
  "996",
  "997",
  "998",
  "999",
]);

const SHIPPING_LIMIT =
  "Print shipping is only available in the contiguous United States.";

function clean(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function validateContiguousAddress(input: {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}): { ok: true; address: DeliveryAddress } | { ok: false; error: string } {
  const name = clean(input.name, 60);
  const line1 = clean(input.line1, 80);
  const line2 = clean(input.line2, 40);
  const city = clean(input.city, 40);
  const state = input.state.trim().toUpperCase();
  const postalCode = input.postalCode.trim();

  if (!name) return { ok: false, error: "Enter the recipient name." };
  if (!line1) return { ok: false, error: "Enter a street address." };
  if (!city) return { ok: false, error: "Enter a city." };
  if (!STATE_CODES.has(state)) return { ok: false, error: SHIPPING_LIMIT };
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
    return { ok: false, error: "Enter a 5-digit ZIP code." };
  }
  if (NON_CONTIGUOUS_ZIPS.has(postalCode.slice(0, 3))) {
    return { ok: false, error: SHIPPING_LIMIT };
  }

  return {
    ok: true,
    address: {
      name,
      line1,
      line2,
      city,
      state,
      postalCode,
      country: "US",
    },
  };
}
