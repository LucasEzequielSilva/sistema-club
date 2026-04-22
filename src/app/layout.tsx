import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontHeading, fontDisplay, fontBody } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acelerator — by Matías Randazzo",
  description: "Método Acelerador de Ganancias — gestión financiera para pymes argentinas.",
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
