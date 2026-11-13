import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { hojeSP } from "@/lib/formato";
import { criarFicha } from "../actions";

export default async function NovaFicha({ searchParams }: { searchParams: Promise<{ aluno?: string; erro?: string }> }) {
  const { aluno: alunoId, erro } = await searchParams;
  const { supabase } = await exigirPersonal();
  const valido = alunoId && /^[0-9a-f-]{36}$/.test(alunoId);
  const [{ data: aluno }, { data: modelos }] = await Promise.all([
    valido ? supabase.from("alunos").select("id, nome").eq("id", alunoId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("fichas").select("id, nome").is("aluno_id", null).order("nome")
  ]);

  return (
    <div className="pilha" style={{ maxWidth: 640 }}>
      <Link href={aluno ? `/painel/alunos/${aluno.id}` : "/painel/treinos"} className="suave">← Voltar</Link>
      <h1>{aluno ? `Nova ficha · ${aluno.nome}` : "Novo modelo de ficha"}</h1>
      <Aviso erro={erro} />
      <form action={criarFicha} className="cartao pilha">
        {aluno && <input type="hidden" name="aluno_id" value={aluno.id} />}
        <label className="campo">Nome*<input name="nome" required maxLength={120} placeholder="Hipertrofia — fase 1" /></label>
        <label className="campo">Objetivo<input name="objetivo" maxLength={300} /></label>
        {aluno && (
          <div className="grade-2">
            <label className="campo">Início<input type="date" name="inicio" defaultValue={hojeSP()} /></label>
            <label className="campo">Fim (troca prevista)<input type="date" name="fim" /></label>
          </div>
        )}
        {(modelos ?? []).length > 0 && (
          <label className="campo">Começar a partir de um modelo
            <select name="modelo_id" defaultValue="">
              <option value="">Ficha em branco</option>
              {(modelos ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
        )}
        {aluno && <p className="suave pequeno">A ficha nova vira a ativa; a anterior é arquivada (continua no histórico).</p>}
        <Enviar>Criar ficha</Enviar>
      </form>
    </div>
  );
}
