export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-[#090d16] px-4 py-12 overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />
      
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
