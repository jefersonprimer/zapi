"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginWithToken } = useAuth();
  const router = useRouter();

  // QR Code Authentication State
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"loading" | "waiting" | "expired" | "approved" | "cancelled">("loading");
  const [timeLeft, setTimeLeft] = useState(60);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQrSession = useCallback(async () => {
    try {
      setQrStatus("loading");
      const res = await fetch(`${API_URL}/auth/web/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Erro ao obter sessão QR");
      const data = await res.json();
      
      setQrCode(`zapi://login/${data.code}`);
      setTimeLeft(data.expiresIn);
      setQrStatus("waiting");

      // Close previous ws if any
      if (wsRef.current) wsRef.current.close();

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Support relative and absolute paths for dev/prod flexibility
      const wsHost = API_URL.startsWith("http")
        ? API_URL.replace(/^http(s)?:\/\//, "")
        : window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/auth/web/ws/${data.sessionId}`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "login_success") {
            setQrStatus("approved");
            loginWithToken(msg.token);
            // Redirect to home
            router.push("/");
          } else if (msg.type === "cancelled") {
            setQrStatus("cancelled");
            socket.close();
          }
        } catch (e) {
          console.error("Failed to parse websocket message:", e);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      socket.onclose = () => {
        // Only mark expired if we are still waiting
        setQrStatus((prev) => (prev === "waiting" ? "expired" : prev));
      };

    } catch (err) {
      console.error(err);
      setQrStatus("expired");
    }
  }, [router, loginWithToken]);

  // Handle countdown timer
  useEffect(() => {
    if (qrStatus === "waiting") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (wsRef.current) wsRef.current.close();
            setQrStatus("expired");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qrStatus]);

  // Initial QR Fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQrSession();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {/* Right Side: QR Code Login */}
        <div className="flex flex-col items-center justify-center text-center p-4 border-t border-neutral-200/60 dark:border-neutral-900 md:border-t-0 md:border-l md:border-neutral-200/60 md:dark:border-neutral-900 md:pl-8">
          <div className="relative p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-2xl mb-4 shadow-sm w-[166px] h-[166px] flex items-center justify-center">
            {qrStatus === "loading" && (
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            )}

            {qrStatus === "waiting" && qrCode && (
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrCode)}`}
                alt="QR Code Login"
                width={140}
                height={140}
                unoptimized
                className="rounded-lg"
              />
            )}

            {(qrStatus === "expired" || qrStatus === "cancelled") && (
              <button
                onClick={fetchQrSession}
                className="flex flex-col items-center justify-center gap-2 text-xs font-semibold text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                <RefreshCw className="w-6 h-6 animate-pulse" />
                <span>Atualizar QR Code</span>
              </button>
            )}

            {qrStatus === "approved" && (
              <div className="flex flex-col items-center justify-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-bounce">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Entrando...</span>
              </div>
            )}
          </div>

          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Entrar com código QR
          </h2>

          {qrStatus === "waiting" && (
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
              Expira em: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{timeLeft}s</span>
            </p>
          )}

          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 max-w-[210px] leading-relaxed">
            {qrStatus === "cancelled"
              ? "Login cancelado no aplicativo. Atualize para tentar novamente."
              : "Escaneie isto com o app do Zapi para fazer login imediatamente."}
          </p>
        </div>
      </div>
    </div>
  );
}
