export type RegionKey =
  | "nepal"
  | "kathmandu"
  | "india"
  | "delhi"
  | "australia"
  | "sydney"
  | "uk"
  | "london"
  | "japan"
  | "tokyo";

export type RegionConfig = {
  key: RegionKey;
  label: string;
  countryCode: string;
  countryName: string;
  openaqCountryCode: string;
  coordinates?: string; // "lon,lat"
  radius?: number; // km
};

export const REGIONS: Record<RegionKey, RegionConfig> = {
  nepal: {
    key: "nepal",
    label: "All Nepal",
    countryCode: "NPL",
    countryName: "Nepal",
    openaqCountryCode: "NP",
  },
  kathmandu: {
    key: "kathmandu",
    label: "Kathmandu Valley",
    countryCode: "NPL",
    countryName: "Nepal",
    openaqCountryCode: "NP",
    coordinates: "85.324,27.717",
    radius: 15,
  },
  india: {
    key: "india",
    label: "All India",
    countryCode: "IND",
    countryName: "India",
    openaqCountryCode: "IN",
  },
  delhi: {
    key: "delhi",
    label: "Delhi",
    countryCode: "IND",
    countryName: "India",
    openaqCountryCode: "IN",
    coordinates: "77.209,28.614",
    radius: 25,
  },
  australia: {
    key: "australia",
    label: "All Australia",
    countryCode: "AUS",
    countryName: "Australia",
    openaqCountryCode: "AU",
  },
  sydney: {
    key: "sydney",
    label: "Sydney",
    countryCode: "AUS",
    countryName: "Australia",
    openaqCountryCode: "AU",
    coordinates: "151.209,-33.869",
    radius: 30,
  },
  uk: {
    key: "uk",
    label: "All UK",
    countryCode: "GBR",
    countryName: "United Kingdom",
    openaqCountryCode: "GB",
  },
  london: {
    key: "london",
    label: "London",
    countryCode: "GBR",
    countryName: "United Kingdom",
    openaqCountryCode: "GB",
    coordinates: "-0.128,51.507",
    radius: 30,
  },
  japan: {
    key: "japan",
    label: "All Japan",
    countryCode: "JPN",
    countryName: "Japan",
    openaqCountryCode: "JP",
  },
  tokyo: {
    key: "tokyo",
    label: "Tokyo",
    countryCode: "JPN",
    countryName: "Japan",
    openaqCountryCode: "JP",
    coordinates: "139.650,35.676",
    radius: 30,
  },
};

export type RegionGroup = {
  country: string;
  regions: RegionKey[];
};

export const REGION_GROUPS: RegionGroup[] = [
  { country: "Nepal", regions: ["nepal", "kathmandu"] },
  { country: "India", regions: ["india", "delhi"] },
  { country: "Australia", regions: ["australia", "sydney"] },
  { country: "United Kingdom", regions: ["uk", "london"] },
  { country: "Japan", regions: ["japan", "tokyo"] },
];
