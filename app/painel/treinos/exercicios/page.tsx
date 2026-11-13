import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { Upload } from "@/components/upload";
import { exigirPersonal } from "@/lib/supabase/server";
import { GRUPOS_MUSCULARES } from "@/lib/formato";
import { Midia, urlsAssinadas } from "@/lib/midia";
import { removerExercicioBiblioteca, salvarExercicioBiblioteca } from "../actions";

export const metadata = { title: "Exercícios" };

type Ex = {
  id: string; nome: string; grupo_muscular: string; equipamento: string | null; instrucoes: string | null;
  video_url: string | null; midia_path: string | null; personal_id: string | null;
};

export default async function ExerciciosPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; erro?: string; grupo?: string; q?: string }>;
}) {
  const { ok, erro, grupo, q } = await searchParams;
  const { supabase, personal } = await exigirPersonal();

  let query = supabase.from("exercicios").select("*").order("nome");
  if (grupo && grupo in GRUPOS_MUSCULARES) query = query.eq("grupo_muscular", grupo);
  if (q) query = query.ilike("nome", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const lista = (data ?? []) as Ex[];
  const urls = await urlsAssinadas(supabase, "exercicios", lista.filter((e) => e.personal_id).map((e) => e.midia_path));

  return (
    <div className="pilha">
      <Link href="/painel/treinos" className="suave">← Treinos</Link>
      <h1>Biblioteca de exercícios</h1>
      <Aviso ok={ok} erro={erro} />

      <section className="cartao">
        <details>
          <summary className="botao">+ Criar exercício</summary>
          <form action={salvarExercicioBiblioteca} className="pilha" style={{ marginTop: 12 }}>
            <CamposExercicio pasta={personal.id} />
            <Enviar>Salvar exercício</Enviar>
          </form>
        </details>
      </section>

      <form className="linha">
        <input name="q" placeholder="Buscar" defaultValue={q ?? ""} style={{ flex: 1, minWidth: 160 }} />
        <select name="grupo" defaultValue={grupo ?? ""} style={{ width: "auto" }}>
          <option value="">Todos os grupos</option>
          {Object.entries(GRUPOS_MUSCULARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="botao botao-sec">Filtrar</button>
      </form>

      <div className="cartao lista">
        {lista.map((e) => (
          <details key={e.id}>
            <summary className="linha entre">
              <span>{e.nome} {e.personal_id && <span className="tag tag-azul">meu</span>}</span>
              <span className="suave pequeno">{GRUPOS_MUSCULARES[e.grupo_muscular]}{e.equipamento ? ` · ${e.equipamento}` : ""}</span>
            </summary>
            <div className="pilha" style={{ marginTop: 10 }}>
              <Midia videoUrl={e.video_url} arquivoUrl={e.midia_path ? urls.get(e.midia_path) : null} nome={e.nome} />
              {e.instrucoes && <p className="suave">{e.instrucoes}</p>}
              {e.personal_id ? (
                <>
                  <form action={salvarExercicioBiblioteca} className="pilha">
                    <input type="hidden" name="id" value={e.id} />
                    <CamposExercicio ex={e} pasta={personal.id} />
                    <Enviar className="botao botao-peq">Salvar</Enviar>
                  </form>
                  <form action={removerExercicioBiblioteca}>
                    <input type="hidden" name="id" value={e.id} />
                    <Enviar className="botao botao-perigo botao-peq" confirmar="Apagar este exercício?">Apagar</Enviar>
                  </form>
                </>
              ) : (
                <p className="suave pequeno">Exercício da biblioteca padrão. Para usar seu vídeo, crie uma versão sua.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function CamposExercicio({ ex, pasta }: { ex?: Ex; pasta: string }) {
  return (
    <>
      <div className="grade-2">
        <label className="campo">Nome*<input name="nome" required maxLength={120} defaultValue={ex?.nome} /></label>
        <label className="campo">Grupo muscular*
          <select name="grupo_muscular" required defaultValue={ex?.grupo_muscular ?? ""}>
            <option value="" disabled>Escolha…</option>
            {Object.entries(GRUPOS_MUSCULARES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Equipamento<input name="equipamento" maxLength={60} defaultValue={ex?.equipamento ?? ""} /></label>
        <label className="campo">Link do vídeo (YouTube)<input name="video_url" type="url" placeholder="https://youtu.be/…" defaultValue={ex?.video_url ?? ""} /></label>
      </div>
      <Upload bucket="exercicios" pasta={pasta} nome="midia_path" maxMB={15} rotulo="Ou envie um GIF/foto/vídeo curto (até 15 MB)"
        aceita="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/webm" />
      <label className="campo">Como executar<textarea name="instrucoes" maxLength={2000} defaultValue={ex?.instrucoes ?? ""} /></label>
    </>
  );
}
