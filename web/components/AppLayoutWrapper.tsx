"use client";

import { usePathname } from "next/navigation";
import GlobalSidebar from "./GlobalSidebar";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/registrar" ||
    pathname.startsWith("/registrar/");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Global Sidebar (Left sidebar on desktop, bottom bar on mobile) */}
      <GlobalSidebar />

      {/* Main Content Area */}
      <div className="flex-grow min-w-0 h-full overflow-hidden flex flex-col relative pb-16 md:pb-0">
        {children}
      </div>
    </div>
  );
}
