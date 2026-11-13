"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Enviar } from "@/components/ui";
import { salvarSessao } from "../../actions";

export type ItemExec = {
  id: string; nome: string; series: number; repeticoes: string; carga: string | null;
  descanso: number | null; metodo: string | null; observacoes: string | null;
  midia: React.ReactNode; ultimaCarga: number | null; ultimasReps: number | null;
};

type Linha = { reps: string; carga: string; feita: boolean };

export function Execucao({ treinoId, itens }: { treinoId: string; itens: ItemExec[] }) {
  const [inicio] = useState(() => new Date().toISOString());
  const [dados, setDados] = useState<Record<string, Linha[]>>(() =>
    Object.fromEntries(
      itens.map((i) => [
        i.id,
        Array.from({ length: i.series }, () => ({
          reps: String(i.ultimasReps ?? (parseInt(i.repeticoes) || "")),
          carga: i.ultimaCarga !== null ? String(i.ultimaCarga) : "",
          feita: false
        }))
      ])
    )
  );
  const [descanso, setDescanso] = useState<{ fim: number; total: number } | null>(null);

  const feitas = Object.values(dados).flat().filter((l) => l.feita).length;
  const total = Object.values(dados).flat().length;

  const payload = useMemo(
    () =>
      JSON.stringify(
        Object.entries(dados).flatMap(([id, linhas]) =>
          linhas.flatMap((l, idx) =>
            l.feita
              ? [{ fichaExercicioId: id, serie: idx + 1, repeticoes: l.reps === "" ? null : Number(l.reps), carga: l.carga === "" ? null : Number(l.carga.replace(",", ".")) }]
              : []
          )
        )
      ),
    [dados]
  );

  function alterar(id: string, idx: number, campo: keyof Linha, valor: string | boolean) {
    setDados((d) => ({ ...d, [id]: d[id].map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)) }));
  }

  function marcar(item: ItemExec, idx: number) {
    const agora = !dados[item.id][idx].feita;
    alterar(item.id, idx, "feita", agora);
    if (agora && item.descanso) setDescanso({ fim: Date.now() + item.descanso * 1000, total: item.descanso });
  }

  return (
    <div className="pilha">
      <div className="linha entre">
        <span className="suave">{feitas}/{total} séries</span>
        {descanso && <Cronometro fim={descanso.fim} onFim={() => setDescanso(null)} />}
      </div>

      {itens.map((item, n) => (
        <section key={item.id} className="cartao pilha">
          <div>
            <h2>{n + 1}. {item.nome}</h2>
            <p className="suave pequeno">
              {item.series} × {item.repeticoes}{item.carga ? ` · ${item.carga}` : ""}{item.descanso ? ` · descanso ${item.descanso}s` : ""}{item.metodo ? ` · ${item.metodo}` : ""}
            </p>
            {item.observacoes && <p className="pequeno">📝 {item.observacoes}</p>}
          </div>
          {item.midia && <details><summary className="destaque pequeno">Ver execução</summary><div style={{ marginTop: 8 }}>{item.midia}</div></details>}
          <div className="pilha" style={{ gap: 8 }}>
            <div className="serie suave pequeno"><span>Série</span><span>Reps</span><span>Kg</span><span /></div>
            {dados[item.id].map((l, idx) => (
              <div key={idx} className="serie" style={l.feita ? { opacity: 0.75 } : undefined}>
                <span className="serie-num">{idx + 1}</span>
                <input inputMode="numeric" value={l.reps} onChange={(e) => alterar(item.id, idx, "reps", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label={`Repetições série ${idx + 1}`} />
                <input inputMode="decimal" value={l.carga} onChange={(e) => alterar(item.id, idx, "carga", e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} aria-label={`Carga série ${idx + 1}`} />
                <button type="button" className={`botao botao-peq ${l.feita ? "" : "botao-sec"}`} onClick={() => marcar(item, idx)} aria-label="Concluir série"><Check size={16} /></button>
              </div>
            ))}
          </div>
          {item.ultimaCarga !== null && <p className="suave pequeno">Última vez: {item.ultimasReps ?? "-"} reps × {item.ultimaCarga} kg</p>}
        </section>
      ))}

      <form action={salvarSessao} className="cartao pilha">
        <input type="hidden" name="treino_id" value={treinoId} />
        <input type="hidden" name="iniciado_em" value={inicio} />
        <input type="hidden" name="series" value={payload} />
        <label className="campo">Esforço percebido (1 leve – 10 máximo)
          <input name="esforco" type="range" min={1} max={10} defaultValue={7} />
        </label>
        <label className="campo">Comentário para o personal<textarea name="observacoes" maxLength={1000} placeholder="Senti dor no ombro, aumentei carga no supino…" /></label>
        <Enviar className="botao botao-bloco">Finalizar treino</Enviar>
      </form>
    </div>
  );
}

function Cronometro({ fim, onFim }: { fim: number; onFim: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());
  const resta = Math.max(0, Math.ceil((fim - agora) / 1000));
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setAgora(n);
      if (n >= fim) {
        clearInterval(t);
        if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
        onFim();
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fim]);
  return <span className="tag tag-amarelo">⏱ Descanso {resta}s</span>;
}
