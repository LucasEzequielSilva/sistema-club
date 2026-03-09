"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ProductCategoriesTab } from "./components/product-categories-tab";
import { CostCategoriesTab } from "./components/cost-categories-tab";
import { PaymentMethodsTab } from "./components/payment-methods-tab";
import { Tag } from "lucide-react";
import { useAccountId } from "@/hooks/use-account-id";

export default function ClassificacionesPage() {
  const { accountId } = useAccountId();
  const [activeTab, setActiveTab] = useState("productos");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Clasificaciones"
        description="Categorías de productos, costos y métodos de pago"
        icon={Tag}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="pagos">Métodos de Pago</TabsTrigger>
        </TabsList>

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
