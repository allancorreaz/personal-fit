/**
 * Cálculo de % de gordura por dobras cutâneas (Jackson & Pollock) + fórmula de Siri.
 * Retorna null se faltar alguma dobra, o sexo ou a idade.
 */
type Dobras = Partial<Record<
  "dobra_peitoral" | "dobra_axilar" | "dobra_triceps" | "dobra_subescapular" | "dobra_abdominal" | "dobra_suprailiaca" | "dobra_coxa",
  number | null
>>;

const siri = (d: number) => Math.round((495 / d - 450) * 10) / 10;

export function percentualGordura(protocolo: string | null, sexo: string | null, idade: number | null, d: Dobras) {
  if (!idade || (sexo !== "M" && sexo !== "F")) return null;
  const v = (k: keyof Dobras) => d[k] ?? null;

  if (protocolo === "pollock7") {
    const campos: (keyof Dobras)[] = ["dobra_peitoral", "dobra_axilar", "dobra_triceps", "dobra_subescapular", "dobra_abdominal", "dobra_suprailiaca", "dobra_coxa"];
    if (campos.some((c) => v(c) === null)) return null;
    const s = campos.reduce((t, c) => t + (v(c) as number), 0);
    const dens = sexo === "M"
      ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
      : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade;
    return siri(dens);
  }

  if (protocolo === "pollock3") {
    const campos: (keyof Dobras)[] = sexo === "M"
      ? ["dobra_peitoral", "dobra_abdominal", "dobra_coxa"]
      : ["dobra_triceps", "dobra_suprailiaca", "dobra_coxa"];
    if (campos.some((c) => v(c) === null)) return null;
    const s = campos.reduce((t, c) => t + (v(c) as number), 0);
    const dens = sexo === "M"
      ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade
      : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade;
    return siri(dens);
  }
  return null;
}

export function imc(pesoKg: number | null, alturaCm: number | null) {
  if (!pesoKg || !alturaCm) return null;
  const m = alturaCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

export const CIRCUNFERENCIAS: [string, string][] = [
  ["pescoco", "Pescoço"], ["ombro", "Ombro"], ["peito", "Peito"], ["cintura", "Cintura"], ["abdomen", "Abdômen"],
  ["quadril", "Quadril"], ["braco_d", "Braço D"], ["braco_e", "Braço E"], ["antebraco_d", "Antebraço D"],
  ["antebraco_e", "Antebraço E"], ["coxa_d", "Coxa D"], ["coxa_e", "Coxa E"], ["panturrilha_d", "Panturrilha D"],
  ["panturrilha_e", "Panturrilha E"]
];

export const DOBRAS: [string, string][] = [
  ["dobra_peitoral", "Peitoral"], ["dobra_axilar", "Axilar média"], ["dobra_triceps", "Tríceps"],
  ["dobra_subescapular", "Subescapular"], ["dobra_abdominal", "Abdominal"], ["dobra_suprailiaca", "Suprailíaca"],
  ["dobra_coxa", "Coxa"]
];
