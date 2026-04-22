"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileNav({ userEmail }: { userEmail?: string } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar — visible only on small screens */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b border-border bg-background z-40 shrink-0">
        <Link href="/tablero" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Image
            src="/brand/icon-app.svg"
            alt="Acelerator"
            width={28}
            height={28}
            className="rounded-lg shrink-0"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground tracking-tight">Acelerator</p>
            <p className="text-[10px] text-muted-foreground">by Matías Randazzo</p>
          </div>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 h-full z-50 lg:hidden transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-10 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <Sidebar onNavigate={() => setOpen(false)} userEmail={userEmail} />
        </div>
      </div>
    </>
  );
}
