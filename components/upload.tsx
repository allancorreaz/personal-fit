"use client";
import { useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Envia um arquivo direto para o Storage e guarda o caminho num <input hidden>,
 * que segue junto com o formulário. O servidor confere se o caminho é da pasta
 * do personal antes de salvar.
 */
export function Upload({
  bucket, pasta, nome, aceita, maxMB, rotulo
}: {
  bucket: string; pasta: string; nome: string; aceita: string; maxMB: number; rotulo: string;
}) {
  const [caminho, setCaminho] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "ok" | string>("");

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.size > maxMB * 1024 * 1024) return setEstado(`Arquivo acima de ${maxMB} MB.`);
    if (!aceita.split(",").includes(arquivo.type)) return setEstado("Formato não aceito.");
    setEstado("enviando");
    const ext = (arquivo.type.split("/")[1] || "bin").replace("jpeg", "jpg").replace("quicktime", "mov");
    const destino = `${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await clienteNavegador().storage.from(bucket).upload(destino, arquivo, { contentType: arquivo.type });
    if (error) return setEstado("Falha no envio. Tente de novo.");
    setCaminho(destino);
    setEstado("ok");
  }

  return (
    <label className="campo">
      {rotulo}
      <input type="file" accept={aceita} onChange={(e) => enviar(e.target.files?.[0])} />
      <input type="hidden" name={nome} value={caminho} />
      {estado === "enviando" && <span className="suave pequeno">Enviando…</span>}
      {estado === "ok" && <span className="destaque pequeno">Arquivo enviado ✓ (salve o formulário)</span>}
      {estado && estado !== "enviando" && estado !== "ok" && <span className="erro-texto pequeno">{estado}</span>}
    </label>
  );
}
