import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/registrar-sw";
import { PRODUTO } from "@/lib/marca";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: PRODUTO.nome, template: `%s · ${PRODUTO.nome}` },
  description: PRODUTO.descricao,
  applicationName: PRODUTO.nome,
  appleWebApp: { capable: true, title: PRODUTO.nome, statusBarStyle: "black-translucent" },
  icons: { icon: "/icone-192.png", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: "#0e1110",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
