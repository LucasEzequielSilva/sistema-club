import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acelerator — Método Acelerador de Ganancias",
    short_name: "Acelerator",
    description:
      "Gestión financiera para pymes argentinas. Ventas, costos y rentabilidad en una sola pantalla.",
    start_url: "/login",
    display: "standalone",
    background_color: "#000e2b",
    theme_color: "#0052fe",
    orientation: "portrait",
    lang: "es-AR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
