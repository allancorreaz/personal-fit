import { formatData } from "@/lib/formato";

/** Gráfico de linha simples em SVG (sem biblioteca). pontos em ordem cronológica. */
export function GraficoLinha({ pontos, unidade }: { pontos: { data: string; valor: number }[]; unidade: string }) {
  if (pontos.length < 2) return <p className="suave pequeno">Precisa de pelo menos 2 registros para o gráfico.</p>;
  const L = 320, A = 150, m = { t: 14, r: 12, b: 22, l: 34 };
  const vals = pontos.map((p) => p.valor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i: number) => m.l + (i * (L - m.l - m.r)) / (pontos.length - 1);
  const y = (v: number) => m.t + ((max - v) * (A - m.t - m.b)) / (max - min);
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const ult = pontos[pontos.length - 1];
  const dif = ult.valor - pontos[0].valor;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${A}`} className="grafico" role="img" aria-label={`Evolução: de ${pontos[0].valor} para ${ult.valor} ${unidade}`}>
        <text x={4} y={y(max) + 3}>{max.toFixed(1)}</text>
        <text x={4} y={y(min) + 3}>{min.toFixed(1)}</text>
        <path className="linha-g" d={d} />
        {pontos.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.valor)} r={3} />)}
        <text x={m.l} y={A - 6}>{formatData(pontos[0].data)}</text>
        <text x={L - m.r} y={A - 6} textAnchor="end">{formatData(ult.data)}</text>
      </svg>
      <figcaption className="suave pequeno">
        Atual {ult.valor} {unidade} · {dif > 0 ? "+" : ""}{dif.toFixed(1)} {unidade} desde o início
      </figcaption>
    </figure>
  );
}
