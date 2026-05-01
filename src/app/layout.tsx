import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontHeading, fontDisplay, fontBody } from "@/lib/fonts";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://acelerator.matirandazzook.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Acelerator — Gestión financiera para pymes by Matías Randazzo",
    template: "%s · Acelerator",
  },
  description:
    "El Método Acelerador de Ganancias de Matías Randazzo, ahora en una app. Controlá ventas, costos, stock y rentabilidad de tu pyme argentina en una sola pantalla.",
  applicationName: "Acelerator",
  authors: [{ name: "Matías Randazzo" }],
  creator: "Matías Randazzo",
  publisher: "Matías Randazzo",
  keywords: [
    "Acelerator",
    "Matías Randazzo",
    "gestión financiera pymes",
    "Método Acelerador de Ganancias",
    "punto de venta",
    "POS pymes argentina",
    "rentabilidad",
    "control de stock",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Acelerator",
    title: "Acelerator — Gestión financiera para pymes by Matías Randazzo",
    description:
      "El Método Acelerador de Ganancias de Matías Randazzo, ahora en una app. Controlá ventas, costos, stock y rentabilidad de tu pyme argentina en una sola pantalla.",
    // images se resuelven automáticamente via app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: "Acelerator — Gestión financiera para pymes by Matías Randazzo",
    description:
      "El Método Acelerador de Ganancias de Matías Randazzo, ahora en una app. Controlá ventas, costos, stock y rentabilidad de tu pyme argentina en una sola pantalla.",
    creator: "@matiasrandazzook",
    // images se resuelven automáticamente via app/twitter-image.tsx
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${fontHeading.variable} ${fontDisplay.variable} ${fontBody.variable} font-sans antialiased`}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
