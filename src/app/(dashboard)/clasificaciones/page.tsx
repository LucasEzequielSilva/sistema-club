"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ProductCategoriesTab } from "./components/product-categories-tab";
import { CostCategoriesTab } from "./components/cost-categories-tab";
import { PaymentMethodsTab } from "./components/payment-methods-tab";
import { PriceListsTab } from "./components/price-lists-tab";
import { Tag } from "lucide-react";
import { useAccountId } from "@/hooks/use-account-id";

export default function ClassificacionesPage() {
  const { accountId } = useAccountId();
  const [activeTab, setActiveTab] = useState("precios");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Clasificaciones"
        description="Listas de precios, categorías y configuración de cobros/pagos"
        icon={Tag}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="precios">Listas de Precios</TabsTrigger>
          <TabsTrigger value="productos">Categorías</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="pagos">Cobros y Canales</TabsTrigger>
        </TabsList>

        <TabsContent value="precios" className="space-y-4">
          <PriceListsTab accountId={accountId ?? ""} />
        </TabsContent>

        <TabsContent value="productos" className="space-y-4">
          <ProductCategoriesTab accountId={accountId ?? ""} />
        </TabsContent>

        <TabsContent value="costos" className="space-y-4">
          <CostCategoriesTab accountId={accountId ?? ""} />
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <PaymentMethodsTab accountId={accountId ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
