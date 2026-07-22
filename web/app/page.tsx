"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/conversas");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-[#0a0a0a]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
    </div>
  );
}
