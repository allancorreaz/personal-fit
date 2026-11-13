import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativo (Android/iOS) com Capacitor.
 * O app abre o site em produção dentro de uma WebView nativa: o mesmo código
 * do PWA vira app de loja, sem duplicar nada. Atualizar o site = atualizar o app.
 *
 * Para gerar:
 *   npx cap add android      (precisa do Android Studio)
 *   npx cap add ios          (precisa de Mac + Xcode)
 *   npx cap sync
 * Troque server.url pelo domínio final antes de publicar.
 */
const config: CapacitorConfig = {
  appId: "br.com.personalfit.app",
  appName: "Personal Fit",
  webDir: "public",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://personal-fit.vercel.app",
    cleartext: false,
    allowNavigation: ["*.supabase.co", "*.mercadopago.com", "*.mercadopago.com.br"]
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always" }
};

export default config;
