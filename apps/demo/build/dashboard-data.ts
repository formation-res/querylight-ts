import fs from "node:fs";
import path from "node:path";

type SourceMetadata = {
  key: string;
  name: string;
  upstreamUrl: string;
  datasetUrl: string;
  retrievedAt: string;
  license: string;
  attribution: string;
  note: string;
};

export type WorldBankRecord = {
  id: string;
  countryCode: string;
  countryName: string;
  region: string;
  incomeLevel: string;
  indicatorId: string;
  indicatorName: string;
  year: number;
  value: number;
};

export type EarthquakeRecord = {
  id: string;
  place: string;
  placeCategory: string;
  magnitude: number;
  depthKm: number;
  significance: number;
  tsunami: number;
  eventType: string;
  occurredAt: string;
  day: string;
  longitude: number;
  latitude: number;
  geometry: string;
};

export type WeatherRecord = {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  day: string;
  hourOfDay: string;
  dayOfWeek: string;
  temperatureC: number;
  precipitationMm: number;
  windSpeedKmh: number;
  humidity: number;
  weatherCode: string;
  geometry: string;
};

export type DashboardDataPayload = {
  generatedAt: string;
  datasets: {
    worldBank: {
      source: SourceMetadata;
      records: WorldBankRecord[];
    };
    earthquakes: {
      source: SourceMetadata;
      records: EarthquakeRecord[];
    };
    weather: {
      source: SourceMetadata;
      records: WeatherRecord[];
    };
  };
};

type WorldBankCountryApiRecord = {
  id: string;
  iso2Code: string;
  name: string;
  region?: { value?: string };
  incomeLevel?: { value?: string };
};

type WorldBankIndicatorApiRecord = {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
};

type UsgsGeoJson = {
  features: Array<{
    id: string;
    properties?: {
      mag?: number | null;
      place?: string | null;
      time?: number | null;
      sig?: number | null;
      tsunami?: number | null;
      type?: string | null;
    };
    geometry?: {
      type: "Point";
      coordinates: [number, number, number];
    };
  }>;
};

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
    relative_humidity_2m?: number[];
    weather_code?: number[];
  };
};

const WORLD_BANK_COUNTRIES = ["US", "DE", "JP", "BR", "IN", "KE"];
const WORLD_BANK_INDICATORS = [
  "SP.POP.TOTL",
  "NY.GDP.MKTP.CD",
  "EN.ATM.CO2E.PC"
];
const WORLD_BANK_MIN_YEAR = 2014;

const WEATHER_CITIES = [
  { city: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.405 },
  { city: "Nairobi", country: "Kenya", latitude: -1.286389, longitude: 36.817223 },
  { city: "New York City", country: "United States", latitude: 40.7128, longitude: -74.006 }
] as const;

const WEATHER_RANGE = {
  startDate: "2024-06-01",
  endDate: "2024-06-10"
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "querylight-ts-demo-builder"
    }
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

function assertNonEmpty<T>(value: T[], label: string): T[] {
  if (value.length === 0) {
    throw new Error(`${label} normalization produced no records`);
  }
  return value;
}

function inferPlaceCategory(place: string): string {
  const lower = place.toLowerCase();
  if (
    lower.includes("off the coast") ||
    lower.includes("near the coast") ||
    lower.includes("ocean") ||
    lower.includes("sea") ||
    lower.includes("gulf") ||
    lower.includes("passage") ||
    lower.includes("channel") ||
    lower.includes("harbor") ||
    lower.includes("harbour") ||
    lower.includes("bay") ||
    lower.includes("islands region") ||
    lower.includes("ridge") ||
    lower.includes("trench")
  ) {
    return "Offshore";
  }
  if (lower.includes("coast")) {
    return "Coastal";
  }
  if (lower.endsWith(" region")) {
    return "Region";
  }
  if (lower.includes(",")) {
    return "Named place";
  }
  if (/\bof\b/.test(lower)) {
    return "Named place";
  }
  return "Region";
}

async function buildWorldBankDataset(retrievedAt: string): Promise<DashboardDataPayload["datasets"]["worldBank"]> {
  const countriesUrl = `https://api.worldbank.org/v2/country/${WORLD_BANK_COUNTRIES.join(";")}?format=json&per_page=100`;
  const countriesResponse = await fetchJson<[unknown, WorldBankCountryApiRecord[]]>(countriesUrl);
  const countryMetadata = new Map(
    (countriesResponse[1] ?? []).map((record) => [
      record.iso2Code,
      {
        region: record.region?.value ?? "Unknown",
        incomeLevel: record.incomeLevel?.value ?? "Unknown"
      }
    ])
  );

  const indicatorResponses = await Promise.all(WORLD_BANK_INDICATORS.map((indicatorId) => {
    const url = `https://api.worldbank.org/v2/country/${WORLD_BANK_COUNTRIES.join(";")}/indicator/${indicatorId}?format=json&per_page=800`;
    return fetchJson<[unknown, WorldBankIndicatorApiRecord[]]>(url);
  }));

  const records = assertNonEmpty(
    indicatorResponses.flatMap(([, rows]) =>
      (rows ?? [])
        .filter((row) => row.value != null && Number(row.date) >= WORLD_BANK_MIN_YEAR)
        .map((row) => ({
          id: `${row.countryiso3code}-${row.indicator.id}-${row.date}`,
          countryCode: row.countryiso3code,
          countryName: row.country.value,
          region: countryMetadata.get(row.country.id)?.region ?? "Unknown",
          incomeLevel: countryMetadata.get(row.country.id)?.incomeLevel ?? "Unknown",
          indicatorId: row.indicator.id,
          indicatorName: row.indicator.value,
          year: Number(row.date),
          value: Number(row.value)
        }))
    ),
    "world bank"
  ).sort((left, right) =>
    left.year - right.year ||
    left.countryName.localeCompare(right.countryName) ||
    left.indicatorName.localeCompare(right.indicatorName)
  );

  return {
    source: {
      key: "world-bank",
      name: "World Bank Indicators API",
      upstreamUrl: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
      datasetUrl: `https://api.worldbank.org/v2/country/${WORLD_BANK_COUNTRIES.join(";")}/indicator/${WORLD_BANK_INDICATORS[0]}?format=json`,
      retrievedAt,
      license: "CC BY 4.0",
      attribution: "World Bank Open Data, licensed under CC BY 4.0 with attribution requirements.",
      note: "Snapshot of selected countries and indicators, normalized from the World Bank Indicators API."
    },
    records
  };
}

async function buildEarthquakeDataset(retrievedAt: string): Promise<DashboardDataPayload["datasets"]["earthquakes"]> {
  const datasetUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
  const payload = await fetchJson<UsgsGeoJson>(datasetUrl);
  const records = assertNonEmpty(
    (payload.features ?? [])
      .filter((feature) => feature.properties?.mag != null && feature.properties?.time != null && feature.geometry?.coordinates)
      .slice(0, 250)
      .map((feature) => {
        const longitude = feature.geometry?.coordinates[0] ?? 0;
        const latitude = feature.geometry?.coordinates[1] ?? 0;
        const depthKm = feature.geometry?.coordinates[2] ?? 0;
        const occurredAt = new Date(feature.properties?.time ?? 0).toISOString();
        const place = feature.properties?.place?.trim() || "Unknown";
        return {
          id: feature.id,
          place,
          placeCategory: inferPlaceCategory(place),
          magnitude: Number(feature.properties?.mag ?? 0),
          depthKm,
          significance: Number(feature.properties?.sig ?? 0),
          tsunami: Number(feature.properties?.tsunami ?? 0),
          eventType: feature.properties?.type?.trim() || "earthquake",
          occurredAt,
          day: occurredAt.slice(0, 10),
          longitude,
          latitude,
          geometry: JSON.stringify({
            type: "Point",
            coordinates: [longitude, latitude]
          })
        };
      }),
    "earthquakes"
  ).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return {
    source: {
      key: "usgs-earthquakes",
      name: "USGS Earthquake Hazards Program Feed",
      upstreamUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
      datasetUrl,
      retrievedAt,
      license: "Public domain",
      attribution: "U.S. Geological Survey earthquake feed, published as public-domain U.S. Government data.",
      note: "Snapshot of recent events from the USGS all-month GeoJSON feed."
    },
    records
  };
}

async function buildWeatherDataset(retrievedAt: string): Promise<DashboardDataPayload["datasets"]["weather"]> {
  const records = assertNonEmpty(
    (
      await Promise.all(WEATHER_CITIES.map(async (city) => {
        const url = new URL("https://archive-api.open-meteo.com/v1/archive");
        url.searchParams.set("latitude", String(city.latitude));
        url.searchParams.set("longitude", String(city.longitude));
        url.searchParams.set("start_date", WEATHER_RANGE.startDate);
        url.searchParams.set("end_date", WEATHER_RANGE.endDate);
        url.searchParams.set(
          "hourly",
          "temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code"
        );

        const response = await fetchJson<OpenMeteoResponse>(url.toString());
        const hourly = response.hourly;
        const timestamps = hourly?.time ?? [];
        return timestamps.map((timestamp, index) => {
          const observedAt = new Date(timestamp).toISOString();
          const dayOfWeek = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(observedAt));
          const hourOfDay = observedAt.slice(11, 13);
          return {
            id: `${city.city}-${observedAt}`,
            city: city.city,
            country: city.country,
            latitude: city.latitude,
            longitude: city.longitude,
            observedAt,
            day: observedAt.slice(0, 10),
            hourOfDay,
            dayOfWeek,
            temperatureC: Number(hourly?.temperature_2m?.[index] ?? 0),
            precipitationMm: Number(hourly?.precipitation?.[index] ?? 0),
            windSpeedKmh: Number(hourly?.wind_speed_10m?.[index] ?? 0),
            humidity: Number(hourly?.relative_humidity_2m?.[index] ?? 0),
            weatherCode: String(hourly?.weather_code?.[index] ?? "unknown"),
            geometry: JSON.stringify({
              type: "Point",
              coordinates: [city.longitude, city.latitude]
            })
          };
        });
      }))
    ).flat(),
    "weather"
  ).sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.city.localeCompare(right.city));

  return {
    source: {
      key: "open-meteo",
      name: "Open-Meteo Historical Weather API",
      upstreamUrl: "https://open-meteo.com/en/docs/historical-weather-api",
      datasetUrl: "https://archive-api.open-meteo.com/v1/archive",
      retrievedAt,
      license: "Open-Meteo licence",
      attribution: "Open-Meteo historical weather API data, with model and source attribution described by Open-Meteo.",
      note: `Snapshot for ${WEATHER_CITIES.map((city) => city.city).join(", ")} between ${WEATHER_RANGE.startDate} and ${WEATHER_RANGE.endDate}.`
    },
    records
  };
}

export async function buildDashboardDataPayload(): Promise<DashboardDataPayload> {
  const retrievedAt = new Date().toISOString();
  const [worldBank, earthquakes, weather] = await Promise.all([
    buildWorldBankDataset(retrievedAt),
    buildEarthquakeDataset(retrievedAt),
    buildWeatherDataset(retrievedAt)
  ]);

  return {
    generatedAt: retrievedAt,
    datasets: {
      worldBank,
      earthquakes,
      weather
    }
  };
}

export async function writeDashboardDataFile(outputPath: string): Promise<void> {
  const payload = await buildDashboardDataPayload();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload), "utf8");
}
