import Link from "next/link";
import { Aviso, type ParamsAviso } from "@/components/aviso";
import { Enviar } from "@/components/ui";
import { exigirPersonal } from "@/lib/supabase/server";
import { criarAluno } from "../../actions";
import { CamposAluno } from "../form-aluno";

export default async function NovoAluno({ searchParams }: { searchParams: ParamsAviso }) {
  const { erro } = await searchParams;
  const { supabase } = await exigirPersonal();
  const { data: planos } = await supabase.from("planos").select("id, nome, ativo").order("nome");
  return (
    <div className="pilha" style={{ maxWidth: 720 }}>
      <Link href="/painel/alunos" className="suave">← Alunos</Link>
      <h1>Novo aluno</h1>
      <Aviso erro={erro} />
      {(planos ?? []).length === 0 && (
        <div className="aviso">Dica: <Link href="/painel/financeiro/planos" className="destaque">crie seus planos</Link> para gerar as cobranças automaticamente.</div>
      )}
      <form action={criarAluno} className="cartao pilha">
        <CamposAluno planos={planos ?? []} />
        <Enviar>Cadastrar aluno</Enviar>
      </form>
    </div>
  );
}
