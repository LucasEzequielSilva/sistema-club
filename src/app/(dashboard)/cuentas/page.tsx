import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Cuentas bancarias"
      tagline="Módulo Finanzas"
      description="Saldos de cuentas, conciliación y transferencias entre bancos. Vas a ver cuánta plata tenés en cada banco en tiempo real."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Cuentas bancarias en Acelerator",
      }}
    />
  );
}
