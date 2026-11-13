/** Converte links do YouTube (watch, youtu.be, shorts) em URL de incorporação. */
export function youtubeEmbed(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.endsWith("youtu.be")) id = u.pathname.slice(1);
    else if (u.hostname.endsWith("youtube.com")) {
      id = u.searchParams.get("v") ?? (u.pathname.match(/\/(shorts|embed)\/([^/?]+)/)?.[2] ?? null);
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

/**
 * Gera links temporários (1h) para mídias do Storage privado.
 * Usa o cliente da sessão: o RLS do Storage decide quem pode ver.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function urlsAssinadas(supabase: any, bucket: string, caminhos: (string | null | undefined)[]) {
  const lista = [...new Set(caminhos.filter((c): c is string => Boolean(c)))];
  const mapa = new Map<string, string>();
  if (lista.length === 0) return mapa;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(lista, 3600);
  for (const d of data ?? []) if (d.signedUrl && d.path) mapa.set(d.path, d.signedUrl);
  return mapa;
}

export function Midia({ videoUrl, arquivoUrl, nome }: { videoUrl?: string | null; arquivoUrl?: string | null; nome: string }) {
  const yt = youtubeEmbed(videoUrl);
  if (yt)
    return (
      <iframe
        className="midia"
        style={{ aspectRatio: "16/9", height: "auto", border: 0 }}
        src={yt}
        title={nome}
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  if (arquivoUrl) {
    if (/\.(mp4|webm)(\?|$)/.test(arquivoUrl))
      return <video className="midia" src={arquivoUrl} muted loop playsInline autoPlay controls />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="midia" src={arquivoUrl} alt={nome} loading="lazy" />;
  }
  if (videoUrl)
    return <a className="destaque pequeno" href={videoUrl} target="_blank" rel="noopener noreferrer">Ver vídeo ↗</a>;
  return null;
}
