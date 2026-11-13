import type { MetadataRoute } from "next";
import { PRODUTO } from "@/lib/marca";

/** PWA: permite "Adicionar à tela inicial" e abre como app, sem barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUTO.nome,
    short_name: PRODUTO.nome,
    description: PRODUTO.descricao,
    start_url: "/entrar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1110",
    theme_color: "#0e1110",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
