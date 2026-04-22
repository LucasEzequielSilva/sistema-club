import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Resumen financiero"
      tagline="Módulo Finanzas"
      description="KPIs, margen de contribución, ROI y distribución de gastos. Vas a poder ver tu negocio en una sola pantalla, con la claridad que te prometió Matías."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Resumen financiero en Acelerator",
      }}
    />
  );
}
