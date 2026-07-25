export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col min-h-screen w-full bg-white dark:bg-neutral-950 overflow-hidden selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-neutral-500/5 dark:bg-neutral-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-neutral-500/5 dark:bg-neutral-500/5 blur-[120px]" />
      
      {/* Sleek Minimal Header - Full Width */}
      <header className="relative z-10 w-full flex items-center justify-start px-8 sm:px-12 py-8">
        <span className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-900 dark:text-white">
          Zapi
        </span>
      </header>

      {/* Centered content below header */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          {children}
        </div>
      </main>
    </div>
  );
}
