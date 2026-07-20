export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] px-4">
      {children}
    </div>
  );
}
