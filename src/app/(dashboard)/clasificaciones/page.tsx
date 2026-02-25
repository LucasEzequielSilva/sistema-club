"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCategoriesTab } from "./components/product-categories-tab";
import { CostCategoriesTab } from "./components/cost-categories-tab";
import { PaymentMethodsTab } from "./components/payment-methods-tab";

const ACCOUNT_ID = "test-account-id"; // TODO: Get from session/context

export default function ClassificacionesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clasificaciones</h1>
        <p className="text-gray-500 mt-2">
          Gestiona las clasificaciones de productos, costos y métodos de pago
        </p>
      </div>

      <Tabs defaultValue="productos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="pagos">Métodos de Pago</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="space-y-4">
          <ProductCategoriesTab accountId={ACCOUNT_ID} />
        </TabsContent>

        <TabsContent value="costos" className="space-y-4">
          <CostCategoriesTab accountId={ACCOUNT_ID} />
        </TabsContent>

        <TabsContent value="pagos" className="space-y-4">
          <PaymentMethodsTab accountId={ACCOUNT_ID} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
