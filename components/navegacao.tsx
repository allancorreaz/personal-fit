"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, CalendarCheck, Dumbbell, Home, LineChart, Settings, Users, Wallet, type LucideIcon
} from "lucide-react";

type ItemNav = { href: string; rotulo: string; icone: LucideIcon; exato?: boolean };

const PAINEL: ItemNav[] = [
  { href: "/painel", rotulo: "Início", icone: Home, exato: true },
  { href: "/painel/alunos", rotulo: "Alunos", icone: Users },
  { href: "/painel/treinos", rotulo: "Treinos", icone: Dumbbell },
  { href: "/painel/financeiro", rotulo: "Financeiro", icone: Wallet },
  { href: "/painel/configuracoes", rotulo: "Ajustes", icone: Settings }
];

const ALUNO: ItemNav[] = [
  { href: "/app", rotulo: "Treino", icone: Dumbbell, exato: true },
  { href: "/app/historico", rotulo: "Histórico", icone: CalendarCheck },
  { href: "/app/evolucao", rotulo: "Evolução", icone: LineChart },
  { href: "/app/pagamentos", rotulo: "Pagamentos", icone: Wallet },
  { href: "/app/perfil", rotulo: "Perfil", icone: Activity }
];

function ativo(pathname: string, item: ItemNav) {
  return item.exato ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Navegacao({ area, posicao }: { area: "painel" | "aluno"; posicao: "topo" | "inferior" }) {
  const p = usePathname();
  const itens = area === "painel" ? PAINEL : ALUNO;
  return (
    <nav className={posicao === "topo" ? "nav-desktop" : "nav-inferior"}>
      {itens.map((i) => {
        const Icone = i.icone;
        return (
          <Link key={i.href} href={i.href} aria-current={ativo(p, i) ? "page" : undefined}>
            {posicao === "inferior" && <Icone size={21} />}
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
