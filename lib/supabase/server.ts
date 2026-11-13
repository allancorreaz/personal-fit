import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { um } from "@/lib/formato";

/**
 * Cliente Supabase do servidor com a chave PÚBLICA (publishable).
 * Quem protege os dados é o RLS, com base na sessão do usuário (cookie).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component: o proxy.ts renova a sessão.
          }
        }
      }
    }
  );
}

export type Personal = {
  id: string;
  nome: string;
  nome_marca: string | null;
  email: string;
  whatsapp: string | null;
  cref: string | null;
  plano_plataforma: string;
  teste_ate: string;
};

/** Quem está logado e qual o papel: personal, aluno (pode ter mais de um personal) ou nenhum. */
export const sessaoAtual = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, personal: null as Personal | null, alunos: [] as AlunoVinculo[] };

  const [{ data: personal }, { data: alunos }] = await Promise.all([
    supabase
      .from("personais")
      .select("id, nome, nome_marca, email, whatsapp, cref, plano_plataforma, teste_ate")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("alunos")
      .select("id, nome, personal_id, personais ( nome, nome_marca )")
      .eq("user_id", user.id)
      .eq("ativo", true)
  ]);

  return {
    supabase,
    user,
    personal: (personal as Personal | null) ?? null,
    alunos: ((alunos ?? []) as unknown as (Omit<AlunoVinculo, "personais"> & { personais: AlunoVinculo["personais"] | AlunoVinculo["personais"][] })[]).map((a) => ({ ...a, personais: um(a.personais) }))
  };
});

export type AlunoVinculo = {
  id: string;
  nome: string;
  personal_id: string;
  personais: { nome: string; nome_marca: string | null } | null;
};

/** Para páginas/ações do painel: exige personal logado (senão redireciona). */
export async function exigirPersonal() {
  const s = await sessaoAtual();
  if (!s.user) (await import("next/navigation")).redirect("/entrar");
  if (!s.personal) (await import("next/navigation")).redirect("/inicio");
  return { supabase: s.supabase, personal: s.personal as Personal, user: s.user! };
}

/** Para o app do aluno: exige aluno vinculado. Usa o 1º vínculo (ou o escolhido). */
export async function exigirAluno() {
  const s = await sessaoAtual();
  if (!s.user) (await import("next/navigation")).redirect("/entrar");
  if (s.alunos.length === 0) (await import("next/navigation")).redirect("/inicio");
  return { supabase: s.supabase, aluno: s.alunos[0], user: s.user!, vinculos: s.alunos };
}
