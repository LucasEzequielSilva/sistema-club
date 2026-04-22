import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Flujo de caja"
      tagline="Módulo Finanzas"
      description="Todos los movimientos de efectivo proyectados día a día. Sabé cuánto vas a tener el lunes, sin calcularlo en el Excel."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Flujo de caja en Acelerator",
      }}
    />
  );
}
