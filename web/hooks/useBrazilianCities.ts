"use client";

import { useEffect, useState } from "react";
import { getBrazilianCities, searchCities, CityItem } from "@/lib/cities";

export function useBrazilianCities() {
  const [cities, setCities] = useState<CityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getBrazilianCities()
      .then((data) => {
        if (isMounted) {
          setCities(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed loading cities:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const search = (query: string, limit = 10): CityItem[] => {
    if (!query || query.trim().length < 1 || cities.length === 0) {
      return [];
    }
    return searchCities(query, cities, limit);
  };

  return {
    cities,
    isLoading,
    isSearching: false,
    search,
  };
}
