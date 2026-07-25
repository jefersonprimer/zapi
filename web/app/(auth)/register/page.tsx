"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  // Validate username format
  const cleanUsername = username.trim().toLowerCase();
  const isUsernameValid =
    cleanUsername.length >= 3 && /^[a-zA-Z0-9_]+$/.test(cleanUsername);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!cleanUsername) {
      setError("Por favor, informe um nome de usuário.");
      return;
    }

    if (!isUsernameValid) {
      setError(
        "O nome de usuário deve ter pelo menos 3 caracteres e conter apenas letras, números e _.",
      );
      return;
    }

    if (password.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    if (!agreeTerms) {
      setError("Você precisa aceitar os Termos de Uso para prosseguir.");
      return;
    }

    setLoading(true);

    try {
      await register(cleanUsername, email.trim(), password);
      router.push("/");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível criar a conta. Tente novamente.";

      // Translate common backend errors to Portuguese if needed
      if (
        message.includes("unique") ||
        message.includes("already exists") ||
        message.includes("Duplicate")
      ) {
        setError("Este e-mail ou nome de usuário já está em uso.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Brand Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Criar nova conta
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
          Preencha os dados abaixo para se cadastrar.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
          >
            Nome de usuário
          </label>
          <input
            id="username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
            placeholder="usuario"
            className="block w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none transition-all"
          />
          {username.length > 0 && !isUsernameValid && (
            <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-500">
              Mínimo 3 caracteres (letras, números e _)
            </p>
          )}
        </div>

        {/* Email Field */}
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

        {/* Password Field */}
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
              minLength={6}
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

        {/* Terms Checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-700 text-black dark:text-white focus:ring-neutral-950 cursor-pointer"
          />
          <label
            htmlFor="terms"
            className="text-xs text-neutral-500 dark:text-neutral-400 cursor-pointer select-none"
          >
            Li e concordo com os{" "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300 hover:underline">
              Termos de Uso
            </span>{" "}
            e{" "}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300 hover:underline">
              Política de Privacidade
            </span>
            .
          </label>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-md p-3 text-center transition-all">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 flex items-center justify-center gap-2 rounded-full bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-950 dark:hover:bg-white text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Criando conta...</span>
            </>
          ) : (
            <span>Criar Conta</span>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-250 transition-colors"
        >
          Já é cadastrado?{" "}
          <span className="underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700">
            Fazer Login
          </span>
        </Link>
      </div>
    </div>
  );
}
