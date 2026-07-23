"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-card-border/50 text-foreground transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-b border-card-border/40 pb-8">
          {/* Brand Info */}
          <div className="flex flex-col space-y-3">
            <Link
              href="/delivery"
              className="flex items-center space-x-2 group"
            >
              <span className="text-lg font-black tracking-tight text-foreground group-hover:text-emerald-500 transition-colors duration-200">
                Zapi Food
              </span>
            </Link>
            <p className="text-xs text-muted-text max-w-xs leading-relaxed">
              O módulo de delivery oficial da Zapi. Conectando você aos melhores
              estabelecimentos da sua cidade.
            </p>
          </div>

          {/* Column 2: Parcerias (Highlight / Cadastrar Loja) */}
          <div className="flex flex-col space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Parcerias
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-foreground font-semibold transition-colors duration-200"
                >
                  <span>Cadastrar seu Restaurante</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-foreground font-semibold transition-colors duration-200"
                >
                  <span>Seja um Entregador</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-foreground font-semibold transition-colors duration-200"
                >
                  <span>Zapi para Empresas</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Suporte & Ajuda */}
          <div className="flex flex-col space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Suporte & Termos
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/ajuda"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-foreground transition-colors duration-200"
                >
                  <span>Central de Ajuda & FAQ</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-text hover:text-foreground transition-colors duration-200"
                >
                  <span>Termos de Uso</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom / Copyright / Terms */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 text-[10px] text-muted-text font-medium">
          <p>
            &copy; {currentYear} Zapi Delivery. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center text-[10px]">
            <Link
              href="/privacidade"
              className="hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <span>&bull;</span>
            <Link
              href="/termos"
              className="hover:text-foreground transition-colors"
            >
              Termos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
