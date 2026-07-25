import Fuse from "fuse.js";

export interface CityItem {
  id?: number;
  nome: string;
  uf: string;
  fullLabel: string;
}

const LOCAL_STORAGE_KEY = "zapi_br_cities_v1";
const IBGE_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

// In-memory cache once loaded in session
let cachedCities: CityItem[] | null = null;
let fuseInstance: Fuse<CityItem> | null = null;
let fetchPromise: Promise<CityItem[]> | null = null;

/**
 * Normalizes text removing diacritics / accents for quick prefix checking
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Loads Brazilian cities from localStorage or IBGE API.
 */
export async function getBrazilianCities(): Promise<CityItem[]> {
  if (cachedCities && cachedCities.length > 0) {
    return cachedCities;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    // 1. Try reading from localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CityItem[];
          if (Array.isArray(parsed) && parsed.length > 5000) {
            cachedCities = parsed;
            initFuse(parsed);
            return parsed;
          }
        }
      } catch (err) {
        console.warn("Failed to parse cached cities from localStorage:", err);
      }
    }

interface IBGECityItem {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      };
    };
  };
  "regiao-imediata"?: {
    "regiao-intermediaria"?: {
      UF?: {
        sigla?: string;
      };
    };
  };
}

    // 2. Fetch from official IBGE API
    try {
      const res = await fetch(IBGE_API_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`IBGE API error status: ${res.status}`);
      
      const rawData = (await res.json()) as IBGECityItem[];
      const cities: CityItem[] = rawData.map((item: IBGECityItem) => {
        const nome = item.nome || "";
        const uf =
          item.microrregiao?.mesorregiao?.UF?.sigla ||
          item["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ||
          "";
        return {
          id: item.id,
          nome,
          uf,
          fullLabel: `${nome} - ${uf}`,
        };
      });

      if (cities.length > 0) {
        cachedCities = cities;
        initFuse(cities);

        // Store in localStorage asynchronously
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cities));
          } catch (e) {
            console.warn("Could not save cities to localStorage (quota exceeded?):", e);
          }
        }
        return cities;
      }
    } catch (err) {
      console.error("Error fetching cities from IBGE API:", err);
    }

    // Fallback list of major Brazilian cities if offline/error
    const fallbackCities: CityItem[] = [
      { nome: "Frederico Westphalen", uf: "RS", fullLabel: "Frederico Westphalen - RS" },
      { nome: "São Paulo", uf: "SP", fullLabel: "São Paulo - SP" },
      { nome: "Rio de Janeiro", uf: "RJ", fullLabel: "Rio de Janeiro - RJ" },
      { nome: "Porto Alegre", uf: "RS", fullLabel: "Porto Alegre - RS" },
      { nome: "Curitiba", uf: "PR", fullLabel: "Curitiba - PR" },
      { nome: "Belo Horizonte", uf: "MG", fullLabel: "Belo Horizonte - MG" },
      { nome: "Brasília", uf: "DF", fullLabel: "Brasília - DF" },
      { nome: "Salvador", uf: "BA", fullLabel: "Salvador - BA" },
      { nome: "Fortaleza", uf: "CE", fullLabel: "Fortaleza - CE" },
      { nome: "Recife", uf: "PE", fullLabel: "Recife - PE" },
      { nome: "Florianópolis", uf: "SC", fullLabel: "Florianópolis - SC" },
      { nome: "Caxias do Sul", uf: "RS", fullLabel: "Caxias do Sul - RS" },
      { nome: "Passo Fundo", uf: "RS", fullLabel: "Passo Fundo - RS" },
      { nome: "Santa Maria", uf: "RS", fullLabel: "Santa Maria - RS" },
      { nome: "Chapecó", uf: "SC", fullLabel: "Chapecó - SC" },
    ];
    cachedCities = fallbackCities;
    initFuse(fallbackCities);
    return fallbackCities;
  })();

  return fetchPromise;
}

function initFuse(cities: CityItem[]) {
  fuseInstance = new Fuse(cities, {
    keys: [
      { name: "nome", weight: 0.7 },
      { name: "fullLabel", weight: 0.2 },
      { name: "uf", weight: 0.1 },
    ],
    threshold: 0.35,
    distance: 100,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

/**
 * Searches cities using exact prefix matching + Fuse.js fuzzy matching.
 */
export function searchCities(query: string, cities: CityItem[], limit = 10): CityItem[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const trimmed = query.trim();
  const normalizedQuery = normalizeText(trimmed);

  // 1. Direct prefix matches
  const prefixMatches: CityItem[] = [];
  const substringMatches: CityItem[] = [];

  for (const city of cities) {
    const normNome = normalizeText(city.nome);
    const normFull = normalizeText(city.fullLabel);

    if (normNome.startsWith(normalizedQuery) || normFull.startsWith(normalizedQuery)) {
      prefixMatches.push(city);
    } else if (normNome.includes(normalizedQuery) || normFull.includes(normalizedQuery)) {
      substringMatches.push(city);
    }
  }

  // If prefix + substring matches give enough results, return them
  const combinedDirect = [...prefixMatches, ...substringMatches];
  if (combinedDirect.length >= limit) {
    return combinedDirect.slice(0, limit);
  }

  // 2. Otherwise supplement with Fuse.js fuzzy matches
  if (!fuseInstance && cities.length > 0) {
    initFuse(cities);
  }

  if (fuseInstance) {
    const fuseResults = fuseInstance.search(trimmed, { limit: limit * 2 });
    const seenLabels = new Set(combinedDirect.map((c) => c.fullLabel));

    for (const res of fuseResults) {
      if (!seenLabels.has(res.item.fullLabel)) {
        combinedDirect.push(res.item);
        seenLabels.add(res.item.fullLabel);
      }
      if (combinedDirect.length >= limit) break;
    }
  }

  return combinedDirect.slice(0, limit);
}
