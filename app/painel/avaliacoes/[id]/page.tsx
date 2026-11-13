import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { AvaliacaoDetalhe } from "@/components/avaliacao-detalhe";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { urlsAssinadas } from "@/lib/midia";
import { formatData } from "@/lib/formato";
import { excluirAvaliacao } from "../actions";

export default async function AvaliacaoPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await exigirPersonal();
  const { data: av } = await supabase.from("avaliacoes").select("*, alunos ( id, nome ), avaliacao_fotos ( posicao, path )").eq("id", id).maybeSingle();
  if (!av) notFound();
  const { data: anterior } = await supabase
    .from("avaliacoes").select("*").eq("aluno_id", av.aluno_id).lt("data", av.data).order("data", { ascending: false }).limit(1).maybeSingle();
  const fotos = (av.avaliacao_fotos ?? []) as { posicao: string; path: string }[];
  const urls = await urlsAssinadas(supabase, "avaliacoes", fotos.map((f) => f.path));

  return (
    <div className="pilha" style={{ maxWidth: 860 }}>
      <Link href={`/painel/alunos/${av.alunos?.id}`} className="suave">← {av.alunos?.nome}</Link>
      <h1>Avaliação de {formatData(av.data)}</h1>
      <Aviso ok={ok} erro={erro} />
      {anterior && <p className="suave pequeno">Comparando com {formatData(anterior.data)}.</p>}
      <AvaliacaoDetalhe atual={av} anterior={anterior} />
      {fotos.length > 0 && (
        <div className="grade">
          {fotos.map((f) => (
            <figure key={f.path} className="cartao" style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls.get(f.path)} alt={f.posicao} className="midia" style={{ maxHeight: 360 }} />
              <figcaption className="suave pequeno">{f.posicao}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {av.observacoes && <div className="cartao"><p>{av.observacoes}</p></div>}
      <form action={excluirAvaliacao}>
        <input type="hidden" name="id" value={id} />
        <Enviar className="botao botao-perigo botao-peq" confirmar="Excluir esta avaliação e as fotos?">Excluir avaliação</Enviar>
      </form>
    </div>
  );
}
