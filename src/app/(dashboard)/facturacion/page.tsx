import { UnderConstruction } from "@/components/shared/under-construction";

export default function Page() {
  return (
    <UnderConstruction
      title="Facturación electrónica ARCA"
      tagline="Integración con AFIP/ARCA"
      description="Emití facturas A, B y C directamente desde cada venta. Certificado digital, CAE automático, y descarga de PDFs listos para tu cliente."
      icon="rocket"
      cta={{
        label: "Quiero que se active antes",
        href: "mailto:hola@matiasrandazzo.com?subject=Quiero el módulo Facturación electrónica ARCA en Acelerator",
      }}
    />
  );
}
