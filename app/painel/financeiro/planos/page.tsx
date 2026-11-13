import Link from "next/link";
import { Aviso, type ParamsAviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/formato";
import { salvarPlano } from "../../actions";

type Plano = { id: string; nome: string; descricao: string | null; valor_centavos: number; meses: number; tipo: string; ativo: boolean };
const PERIODOS: Record<number, string> = { 1: "Mensal", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual" };

export default async function PlanosPage({ searchParams }: { searchParams: ParamsAviso }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await exigirPersonal();
  const { data } = await supabase.from("planos").select("*").order("ativo", { ascending: false }).order("nome");
  const planos = (data ?? []) as Plano[];

  return (
    <div className="pilha" style={{ maxWidth: 760 }}>
      <Link href="/painel/financeiro" className="suave">← Financeiro</Link>
      <h1>Planos de consultoria</h1>
      <p className="suave">O plano define o valor e de quanto em quanto tempo a cobrança é gerada para o aluno.</p>
      <Aviso ok={ok} erro={erro} />
      <section className="cartao">
        <details open={planos.length === 0}>
          <summary className="botao">+ Novo plano</summary>
          <form action={salvarPlano} className="pilha" style={{ marginTop: 12 }}><CamposPlano /><Enviar>Salvar plano</Enviar></form>
        </details>
      </section>
      <div className="cartao lista">
        {planos.map((p) => (
          <details key={p.id}>
            <summary className="linha entre">
              <span>{p.nome}{!p.ativo && <span className="suave"> (inativo)</span>}</span>
              <span className="suave">{formatBRL(p.valor_centavos)} · {p.tipo === "avulso" ? "Avulso" : PERIODOS[p.meses]}</span>
            </summary>
            <form action={salvarPlano} className="pilha" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={p.id} />
              <CamposPlano p={p} />
              <Enviar className="botao botao-peq">Salvar</Enviar>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}

function CamposPlano({ p }: { p?: Plano }) {
  return (
    <div className="grade-2">
      <label className="campo">Nome*<input name="nome" required maxLength={80} defaultValue={p?.nome} placeholder="Consultoria online mensal" /></label>
      <label className="campo">Valor (R$)*<input name="valor" inputMode="decimal" required defaultValue={p ? (p.valor_centavos / 100).toFixed(2).replace(".", ",") : ""} placeholder="150,00" /></label>
      <label className="campo">Tipo
        <select name="tipo" defaultValue={p?.tipo ?? "recorrente"}>
          <option value="recorrente">Recorrente (gera cobrança sozinho)</option>
          <option value="avulso">Avulso (você cria a cobrança)</option>
        </select>
      </label>
      <label className="campo">Periodicidade
        <select name="meses" defaultValue={String(p?.meses ?? 1)}>
          {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="campo">Descrição<input name="descricao" maxLength={500} defaultValue={p?.descricao ?? ""} /></label>
      {p && (
        <label className="campo">Situação
          <select name="ativo" defaultValue={p.ativo ? "true" : "false"}><option value="true">Ativo</option><option value="false">Inativo</option></select>
        </label>
      )}
    </div>
  );
}
