import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Cuadro de KPIs"
      tagline="Módulo Finanzas"
      description="Indicadores clave del negocio en un solo dashboard. Ventas, costos, margen, rotación — todo junto."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Cuadro de KPIs en Acelerator",
      }}
    />
  );
}
