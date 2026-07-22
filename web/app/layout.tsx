import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CallProvider } from "@/lib/call-context";
import CallOverlay from "@/components/CallOverlay";
import AppLayoutWrapper from "@/components/AppLayoutWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Zapi",
  description:
    "Um aplicativo moderno que reúne mensagens, rede social e delivery. Crie sua conta com e-mail, encontre pessoas pelo @usuário e descubra tudo o que está perto de você.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script
          async
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && systemDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  if (saved === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full antialiased">
        <ThemeProvider>
          <AuthProvider>
            <CallProvider>
              <AppLayoutWrapper>{children}</AppLayoutWrapper>
              <CallOverlay />
            </CallProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
