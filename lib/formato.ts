/** Formatação e datas (fuso de São Paulo). */

export function formatBRL(centavos: number | null | undefined) {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-11-10" → "10/11/2026" sem passar por Date (evita erro de fuso) */
export function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function somarDias(isoData: string, dias: number) {
  const d = new Date(`${isoData}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function normalizarWhatsapp(valor: string | null | undefined) {
  const digitos = (valor ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

export function formatWhatsapp(numero: string | null | undefined) {
  if (!numero) return "—";
  const n = numero.replace(/^55/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return numero;
}

/** Converte "12,5" ou "12.5" em número; vazio → null */
export function numeroOuNulo(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "R$ 150,00" / "150" / "150,5" → centavos inteiros */
export function reaisParaCentavos(v: FormDataEntryValue | null) {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function idade(nascimento: string | null | undefined) {
  if (!nascimento) return null;
  const [y, m, d] = nascimento.split("-").map(Number);
  const [hy, hm, hd] = hojeSP().split("-").map(Number);
  let i = hy - y;
  if (hm < m || (hm === m && hd < d)) i--;
  return i;
}

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

export const GRUPOS_MUSCULARES: Record<string, string> = {
  peito: "Peito", costas: "Costas", ombros: "Ombros", biceps: "Bíceps", triceps: "Tríceps",
  antebraco: "Antebraço", abdomen: "Abdômen", quadriceps: "Quadríceps", posterior: "Posterior de coxa",
  gluteos: "Glúteos", panturrilha: "Panturrilha", corpo_inteiro: "Corpo inteiro", cardio: "Cardio",
  mobilidade: "Mobilidade"
};

export const SITUACOES = {
  atrasado: { label: "Atrasado", classe: "tag-vermelho" },
  vence_em_breve: { label: "Vence em breve", classe: "tag-amarelo" },
  em_dia: { label: "Em dia", classe: "tag-verde" },
  sem_cobranca: { label: "Sem cobrança", classe: "tag-cinza" }
} as const;
export type Situacao = keyof typeof SITUACOES;

export function linkWhatsapp(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Relação "muitos-para-um" vinda do Supabase (ex.: cobranca.alunos).
 * Sem os tipos gerados o TypeScript acha que é lista; em runtime é objeto.
 * Esta função aceita os dois formatos com segurança.
 */
export function um<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
