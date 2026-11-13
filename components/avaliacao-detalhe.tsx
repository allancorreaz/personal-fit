import { CIRCUNFERENCIAS, DOBRAS, imc } from "@/lib/avaliacao";

type Av = Record<string, unknown> & { peso_kg: number | null; altura_cm: number | null; percentual_gordura: number | null };

/** Tabela da avaliação com diferença em relação à anterior. */
export function AvaliacaoDetalhe({ atual, anterior }: { atual: Av; anterior?: Av | null }) {
  const linha = (rotulo: string, k: string, unidade: string) => {
    const v = atual[k] as number | null;
    if (v === null || v === undefined) return null;
    const a = anterior?.[k] as number | null | undefined;
    const dif = a !== null && a !== undefined ? Number(v) - Number(a) : null;
    return (
      <tr key={k}>
        <td>{rotulo}</td>
        <td><strong>{Number(v)}</strong> {unidade}</td>
        <td className="suave">{dif !== null ? `${dif > 0 ? "+" : ""}${dif.toFixed(1)}` : "—"}</td>
      </tr>
    );
  };
  const massaGorda = atual.peso_kg && atual.percentual_gordura ? (Number(atual.peso_kg) * Number(atual.percentual_gordura)) / 100 : null;
  const valorImc = imc(Number(atual.peso_kg) || null, Number(atual.altura_cm) || null);

  return (
    <div className="pilha">
      <div className="grade">
        <div className="cartao"><div className="rotulo">Peso</div><div className="numero">{atual.peso_kg ?? "—"} <span className="suave">kg</span></div></div>
        <div className="cartao"><div className="rotulo">% Gordura</div><div className="numero">{atual.percentual_gordura ?? "—"}<span className="suave">%</span></div></div>
        <div className="cartao"><div className="rotulo">Massa magra</div><div className="numero">{massaGorda !== null ? (Number(atual.peso_kg) - massaGorda).toFixed(1) : "—"} <span className="suave">kg</span></div></div>
        <div className="cartao"><div className="rotulo">IMC</div><div className="numero">{valorImc ?? "—"}</div></div>
      </div>
      <div className="cartao rolavel">
        <table className="tabela">
          <thead><tr><th>Medida</th><th>Valor</th><th>vs anterior</th></tr></thead>
          <tbody>
            {linha("Peso", "peso_kg", "kg")}
            {linha("% Gordura", "percentual_gordura", "%")}
            {CIRCUNFERENCIAS.map(([k, r]) => linha(r, k, "cm"))}
            {DOBRAS.map(([k, r]) => linha(`Dobra ${r.toLowerCase()}`, k, "mm"))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
