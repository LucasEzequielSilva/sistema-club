import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
          <Compass className="w-7 h-7 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            404 — No encontramos esa página
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Te perdiste, capo
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La ruta que pediste no existe o se movió. Volvé al tablero y
            seguimos desde ahí.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild>
            <Link href="/tablero" className="gap-2">
              <Home className="w-4 h-4" /> Volver al tablero
            </Link>
          </Button>
        </div>
        <div className="pt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Image src="/brand/icon-app.svg" alt="Acelerator" width={16} height={16} className="opacity-70" />
          <span>Acelerator · by Matías Randazzo</span>
        </div>
      </div>
    </div>
  );
}
