"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { slugify } from "@/lib/utils";

export default function DeliveryPage() {
  const router = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCity = localStorage.getItem("zapi_user_city");
      if (storedCity && storedCity !== "all") {
        router.replace(`/delivery/${slugify(storedCity)}`);
        return;
      }
    }

    // If there is no token (anonymous user), we can redirect to /delivery/all immediately.
    // Otherwise, we wait for layout.tsx to load the addresses and redirect.
    if (!token) {
      router.replace("/delivery/all");
    }
  }, [router, token]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
    </div>
  );
}
