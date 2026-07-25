"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao entrar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full border border-neutral-200/60 dark:border-neutral-900 rounded-xl p-6 sm:p-8 bg-neutral-50/30 dark:bg-neutral-900/10 shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left Side: Form */}
        <div className="flex flex-col justify-between space-y-6">
          <div>
            {/* Brand Header */}
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Entrar na sua conta
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                Insira seu e-mail e senha para continuar.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
                >
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.com"
                  className="block w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
                >
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800 rounded-md pl-3 pr-10 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 stroke-[1.5]" />
                    ) : (
                      <Eye className="h-4 w-4 stroke-[1.5]" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-md p-3 text-center transition-all">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 flex items-center justify-center gap-2 rounded-full bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-950 dark:hover:bg-white text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>
          </div>

          <div className="pt-4 text-center md:text-left border-t border-neutral-100 dark:border-neutral-900 md:border-t-0">
            <Link
              href="/register"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-250 transition-colors"
            >
              Ainda não tem conta?{" "}
              <span className="underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700">
                Criar uma
              </span>
            </Link>
          </div>
        </div>

        {/* Right Side: QR Code login (Visual only) */}
        <div className="flex flex-col items-center justify-center text-center p-4 border-t border-neutral-200/60 dark:border-neutral-900 md:border-t-0 md:border-l md:border-neutral-200/60 md:dark:border-neutral-900 md:pl-8">
          <div className="relative p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl mb-5 shadow-sm">
            {/* Minimalist QR Code mockup in SVG */}
            <svg
              width="140"
              height="140"
              viewBox="0 0 160 160"
              fill="none"
              className="text-neutral-900 dark:text-white"
            >
              {/* Top Left Finder Pattern */}
              <rect
                x="10"
                y="10"
                width="40"
                height="40"
                stroke="currentColor"
                strokeWidth="4"
              />
              <rect x="20" y="20" width="20" height="20" fill="currentColor" />

              {/* Top Right Finder Pattern */}
              <rect
                x="110"
                y="10"
                width="40"
                height="40"
                stroke="currentColor"
                strokeWidth="4"
              />
              <rect x="120" y="20" width="20" height="20" fill="currentColor" />

              {/* Bottom Left Finder Pattern */}
              <rect
                x="10"
                y="110"
                width="40"
                height="40"
                stroke="currentColor"
                strokeWidth="4"
              />
              <rect x="20" y="120" width="20" height="20" fill="currentColor" />

              {/* Abstract QR code dots */}
              <rect x="60" y="15" width="10" height="10" fill="currentColor" />
              <rect x="80" y="25" width="15" height="10" fill="currentColor" />
              <rect x="65" y="40" width="10" height="20" fill="currentColor" />

              <rect x="15" y="60" width="20" height="10" fill="currentColor" />
              <rect x="25" y="80" width="10" height="15" fill="currentColor" />

              <rect x="120" y="60" width="10" height="20" fill="currentColor" />
              <rect x="135" y="70" width="15" height="10" fill="currentColor" />
              <rect x="110" y="90" width="20" height="10" fill="currentColor" />

              <rect x="60" y="115" width="20" height="10" fill="currentColor" />
              <rect x="70" y="130" width="10" height="15" fill="currentColor" />
              <rect x="90" y="120" width="10" height="10" fill="currentColor" />

              <rect
                x="110"
                y="125"
                width="20"
                height="20"
                fill="currentColor"
              />
              <rect
                x="135"
                y="115"
                width="10"
                height="10"
                fill="currentColor"
              />
              <rect
                x="125"
                y="140"
                width="20"
                height="10"
                fill="currentColor"
              />

              {/* Center 'Z' overlay */}
              <rect
                x="58"
                y="58"
                width="44"
                height="44"
                fill="white"
                className="dark:fill-neutral-900"
              />
              <rect
                x="60"
                y="60"
                width="40"
                height="40"
                fill="currentColor"
                rx="4"
              />
              <text
                x="80"
                y="88"
                fill="white"
                className="dark:fill-neutral-900 font-bold text-2xl tracking-tighter"
                textAnchor="middle"
              >
                Z
              </text>
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Entrar com código QR
          </h2>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 max-w-[210px] leading-relaxed">
            Escaneie isto com o app do Zapi para fazer login imediatamente.
          </p>
        </div>
      </div>
    </div>
  );
}
