import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Estado de resultados"
      tagline="Módulo Finanzas"
      description="El P&L completo de tu empresa, calculado automáticamente desde tus ventas y compras."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Estado de resultados en Acelerator",
      }}
    />
  );
}
