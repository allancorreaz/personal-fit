type Plano = { id: string; nome: string; ativo: boolean };
type Aluno = {
  id?: string; nome?: string; email?: string | null; whatsapp?: string | null; data_nascimento?: string | null;
  sexo?: string | null; objetivo?: string | null; observacoes?: string | null; plano_id?: string | null; dia_vencimento?: number;
};

export function CamposAluno({ aluno = {}, planos }: { aluno?: Aluno; planos: Plano[] }) {
  return (
    <div className="pilha">
      {aluno.id && <input type="hidden" name="id" value={aluno.id} />}
      <label className="campo">Nome*<input name="nome" defaultValue={aluno.nome} required minLength={2} maxLength={120} /></label>
      <div className="grade-2">
        <label className="campo">E-mail (necessário para app e Pix)<input name="email" type="email" defaultValue={aluno.email ?? ""} /></label>
        <label className="campo">WhatsApp<input name="whatsapp" inputMode="tel" placeholder="(21) 99999-9999" defaultValue={aluno.whatsapp?.replace(/^55/, "") ?? ""} /></label>
        <label className="campo">Nascimento<input name="data_nascimento" type="date" defaultValue={aluno.data_nascimento ?? ""} /></label>
        <label className="campo">Sexo
          <select name="sexo" defaultValue={aluno.sexo ?? ""}>
            <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option>
          </select>
        </label>
        <label className="campo">Plano de consultoria
          <select name="plano_id" defaultValue={aluno.plano_id ?? ""}>
            <option value="">Sem plano (cobrança avulsa)</option>
            {planos.filter((p) => p.ativo || p.id === aluno.plano_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="campo">Dia de vencimento (1–28)<input name="dia_vencimento" type="number" min={1} max={28} defaultValue={aluno.dia_vencimento ?? 10} /></label>
      </div>
      <label className="campo">Objetivo<input name="objetivo" maxLength={300} placeholder="Hipertrofia, emagrecimento, condicionamento…" defaultValue={aluno.objetivo ?? ""} /></label>
      <label className="campo">Observações (só você vê)<textarea name="observacoes" maxLength={2000} defaultValue={aluno.observacoes ?? ""} /></label>
    </div>
  );
}
