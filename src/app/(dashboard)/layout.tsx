import { Sidebar } from "@/components/shared/sidebar";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-4">
          {children}
        </div>
      </main>
    </div>
  );
}
