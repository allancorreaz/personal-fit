import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { Upload } from "@/components/upload";
import { exigirPersonal } from "@/lib/supabase/server";
import { CIRCUNFERENCIAS, DOBRAS } from "@/lib/avaliacao";
import { hojeSP, idade } from "@/lib/formato";
import { salvarAvaliacao } from "../actions";

export default async function NovaAvaliacao({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string }> }) {
  const { aluno: alunoId, erro } = await searchParams;
  if (!alunoId || !/^[0-9a-f-]{36}$/.test(alunoId)) notFound();
  const { supabase, personal } = await exigirPersonal();
  const [{ data: aluno }, { data: ultima }] = await Promise.all([
    supabase.from("alunos").select("id, nome, sexo, data_nascimento").eq("id", alunoId).maybeSingle(),
    supabase.from("avaliacoes").select("altura_cm").eq("aluno_id", alunoId).order("data", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (!aluno) notFound();
  const anos = idade(aluno.data_nascimento);
  const pasta = `${personal.id}/${aluno.id}`;
  const num = (name: string, rotulo: string, step = "0.1") => (
    <label key={name} className="campo">{rotulo}<input name={name} inputMode="decimal" type="number" step={step} min={0} /></label>
  );

  return (
    <div className="pilha" style={{ maxWidth: 820 }}>
      <Link href={`/painel/alunos/${aluno.id}`} className="suave">← {aluno.nome}</Link>
      <h1>Nova avaliação física</h1>
      <Aviso erro={erro} />
      {(!aluno.sexo || anos === null) && (
        <div className="aviso">Para calcular o % de gordura pelas dobras, cadastre o sexo e a data de nascimento do aluno.</div>
      )}
      <form action={salvarAvaliacao} className="pilha">
        <input type="hidden" name="aluno_id" value={aluno.id} />
        <section className="cartao pilha">
          <h2>Medidas básicas</h2>
          <div className="grade">
            <label className="campo">Data<input type="date" name="data" defaultValue={hojeSP()} /></label>
            {num("peso_kg", "Peso (kg)")}
            <label className="campo">Altura (cm)<input name="altura_cm" type="number" step="0.1" defaultValue={ultima?.altura_cm ?? ""} /></label>
            <label className="campo">Protocolo
              <select name="protocolo" defaultValue="pollock7">
                <option value="pollock7">Pollock 7 dobras</option>
                <option value="pollock3">Pollock 3 dobras</option>
                <option value="bioimpedancia">Bioimpedância (informar %)</option>
                <option value="manual">Informar % manualmente</option>
              </select>
            </label>
            {num("percentual_gordura", "% gordura (se não for por dobras)")}
          </div>
        </section>
        <section className="cartao pilha">
          <h2>Dobras cutâneas (mm)</h2>
          <p className="suave pequeno">Pollock 3 — homem: peitoral, abdominal, coxa · mulher: tríceps, suprailíaca, coxa.</p>
          <div className="grade">{DOBRAS.map(([k, r]) => num(k, r))}</div>
        </section>
        <section className="cartao pilha">
          <h2>Circunferências (cm)</h2>
          <div className="grade">{CIRCUNFERENCIAS.map(([k, r]) => num(k, r))}</div>
        </section>
        <section className="cartao pilha">
          <h2>Fotos de evolução</h2>
          <p className="suave pequeno">Ficam privadas: só você e o aluno veem.</p>
          <div className="grade">
            {(["frente", "lado", "costas"] as const).map((p) => (
              <Upload key={p} bucket="avaliacoes" pasta={pasta} nome={`foto_${p}`} maxMB={8} rotulo={p[0].toUpperCase() + p.slice(1)} aceita="image/jpeg,image/png,image/webp,image/heic" />
            ))}
          </div>
        </section>
        <label className="campo">Observações<textarea name="observacoes" maxLength={2000} /></label>
        <Enviar>Salvar avaliação</Enviar>
      </form>
    </div>
  );
}
