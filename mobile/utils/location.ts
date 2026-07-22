import * as Location from "expo-location";

export interface LocationAddressResult {
  estado: string;
  cidade: string;
  bairro: string;
  cep: string;
  rua: string;
  numero: string;
  latitude: number;
  longitude: number;
}

const STATE_NAME_TO_UF: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapá: "AP",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceará: "CE",
  ceara: "CE",
  "distrito federal": "DF",
  "espírito santo": "ES",
  "espirito santo": "ES",
  goiás: "GO",
  goias: "GO",
  maranhão: "MA",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  pará: "PA",
  para: "PA",
  paraíba: "PB",
  paraiba: "PB",
  paraná: "PR",
  parana: "PR",
  pernambuco: "PE",
  piauí: "PI",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondônia: "RO",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "são paulo": "SP",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const VALID_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]);

function normalizeUF(regionOrState: string | null | undefined): string {
  if (!regionOrState) return "";
  const cleaned = regionOrState.trim();
  if (cleaned.length === 2 && VALID_UFS.has(cleaned.toUpperCase())) {
    return cleaned.toUpperCase();
  }
  const lower = cleaned.toLowerCase().replace(/^estado de\s+/i, "");
  return STATE_NAME_TO_UF[lower] || "";
}

function formatCep(rawCep: string | null | undefined): string {
  if (!rawCep) return "";
  const clean = rawCep.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return rawCep;
}

export async function getCurrentUserAddress(): Promise<LocationAddressResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permissão para acessar a localização foi negada.");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = location.coords;

  let result: Partial<LocationAddressResult> = {
    latitude,
    longitude,
    estado: "",
    cidade: "",
    bairro: "",
    cep: "",
    rua: "",
    numero: "",
  };

  // Try native reverse geocode first (expo-location)
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      result.rua = addr.street || addr.name || "";
      result.numero = addr.streetNumber || "";
      result.bairro = addr.district || addr.subregion || "";
      result.cidade = addr.city || addr.subregion || "";
      result.estado = normalizeUF(addr.region);
      result.cep = formatCep(addr.postalCode);
    }
  } catch (err) {
    console.warn("expo-location reverseGeocodeAsync warning:", err);
  }

  // Fallback or complement using OpenStreetMap Nominatim if key fields are missing
  if (!result.rua || !result.cidade || !result.estado) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            "User-Agent": "ZapiMobileApp/1.0",
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const address = data.address || {};

        if (!result.rua) {
          result.rua = address.road || address.pedestrian || address.suburb || address.amenity || "";
        }
        if (!result.numero) {
          result.numero = address.house_number || "";
        }
        if (!result.bairro) {
          result.bairro = address.neighbourhood || address.suburb || address.quarter || address.residential || "";
        }
        if (!result.cidade) {
          result.cidade = address.city || address.town || address.village || address.municipality || "";
        }
        if (!result.estado) {
          result.estado = normalizeUF(address.state);
        }
        if (!result.cep) {
          result.cep = formatCep(address.postcode);
        }
      }
    } catch (fallbackErr) {
      console.warn("Nominatim fallback warning:", fallbackErr);
    }
  }

  return {
    latitude: result.latitude || latitude,
    longitude: result.longitude || longitude,
    estado: result.estado || "",
    cidade: result.cidade || "",
    bairro: result.bairro || "",
    cep: result.cep || "",
    rua: result.rua || "",
    numero: result.numero || "",
  };
}
