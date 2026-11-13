/** Mostra ?ok= ou ?erro= vindos de um redirect de server action. */
export function Aviso({ ok, erro }: { ok?: string; erro?: string }) {
  if (erro) return <div className="aviso aviso-erro" role="alert">{erro}</div>;
  if (ok) return <div className="aviso aviso-ok" role="status">{ok}</div>;
  return null;
}

export type ParamsAviso = Promise<{ ok?: string; erro?: string }>;
