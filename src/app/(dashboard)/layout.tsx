import { Sidebar } from "@/components/shared/sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { AIAssistant } from "@/components/shared/ai-assistant";
import { KeyboardShortcutsModal } from "@/components/shared/keyboard-shortcuts-modal";
import { OnboardingProgressPill } from "@/components/onboarding/progress-pill";
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar + drawer */}
        <MobileNav />
        <div className="flex-1 overflow-auto">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </div>
      </main>
      <AIAssistant />
      <KeyboardShortcutsModal />
      {/* Onboarding — progress pill para páginas post-wizard */}
      <OnboardingProgressPill />
    </div>
  );
}
