"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Loader2,
  Bot,
  RotateCcw,
  Brain,
  Trash2,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";

type Memory = {
  id: string;
  category: string;
  content: string;
  source: string;
  createdAt: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ActionMessage = {
  role: "action";
  status: "running" | "success" | "error";
  label: string;
  detail?: string;
  errorMsg?: string;
};

type Message = ChatMessage | ActionMessage;

// ─── Helpers para acciones ────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  "/tablero": "Tablero",
  "/ventas": "Ventas",
  "/compras": "Compras",
  "/pos": "Punto de Venta",
  "/productos": "Productos",
  "/proveedores": "Proveedores",
  "/mercaderia": "Mercadería",
  "/cuentas": "Cuentas",
  "/clasificaciones": "Clasificaciones",
  "/cashflow": "Cashflow",
  "/resumen": "Resumen",
  "/estados-resultados": "Estados de Resultados",
  "/cuadro-resumen": "Cuadro KPIs",
};

function getActionLabel(data: Record<string, unknown>): string {
  if (data.tipo === "crear_producto") return `Creando "${data.nombre}"`;
  if (data.tipo === "navegar") {
    const nombre = ROUTE_LABELS[data.ruta as string] ?? data.ruta as string;
    return `Navegando a ${nombre}`;
  }
  if (data.tipo === "registrar_cobro") {
    return data.monto ? `Registrando cobro de $${data.monto}` : "Registrando cobro";
  }
  return "Ejecutando acción";
}

function getSuccessDetail(data: Record<string, unknown>, result: Record<string, unknown>): string {
  if (data.tipo === "crear_producto") {
    const cat = result.categoria ? ` en ${result.categoria}` : "";
    const pv = result.precio_venta ? ` · PV $${result.precio_venta}` : "";
    const margen = result.margen_pct != null ? ` · Margen ${result.margen_pct}%` : "";
    return `"${result.nombre}"${cat}${pv}${margen}`;
  }
  if (data.tipo === "registrar_cobro") {
    const concepto = result.concepto ? `"${result.concepto}" · ` : "";
    const estado = result.nuevo_estado as string ?? "";
    return `${concepto}${estado}`;
  }
  return "Listo";
}

const PAGE_LABELS: Record<string, string> = {
  "/tablero": "Tablero",
  "/ventas": "Ventas",
  "/compras": "Compras",
  "/pos": "Punto de Venta",
  "/productos": "Productos",
  "/proveedores": "Proveedores",
  "/clasificaciones": "Clasificaciones",
  "/mercaderia": "Mercadería",
  "/resumen": "Resumen financiero",
  "/estados-resultados": "Estados de resultados",
  "/cuentas": "Cuentas y flujo",
  "/cashflow": "Cashflow semanal",
  "/cuadro-resumen": "Cuadro KPIs",
  "/facturacion": "Facturación AFIP",
};

const WELCOME = `¡Ey! Soy **Costito**, tu asistente de Sistema Club 🤝

Te puedo dar una mano con:
- **Configurar** tu negocio desde cero
- **Explicar** cómo usar cualquier módulo
- **Analizar** tus números y tirarte recomendaciones
- **Responder** cualquier duda de gestión

¿Por dónde arrancamos?`;

const CONTEXTUAL_PROMPTS: Record<string, string[]> = {
  "/tablero": [
    "¿Cómo vengo este mes?",
    "¿Qué debería configurar primero?",
    "Explicame el tablero",
  ],
  "/ventas": [
    "¿Cuáles son mis productos más vendidos?",
    "¿Cómo registro una venta?",
    "Analizá mis ventas recientes",
  ],
  "/compras": [
    "¿Cómo registro una compra?",
    "¿Qué proveedores uso más?",
    "Ayudame a entender el módulo",
  ],
  "/productos": [
    "¿Cómo agrego un producto nuevo?",
    "¿Cómo configuro el precio de venta?",
    "Explicame el margen de contribución",
  ],
  "/proveedores": [
    "¿Cómo agrego un proveedor?",
    "¿Para qué sirven los proveedores?",
    "Ayudame a organizarlos",
  ],
  "/mercaderia": [
    "¿Cómo hago un ajuste de stock?",
    "¿Qué es un ingreso de mercadería?",
    "Tengo diferencias de inventario",
  ],
  "/cuentas": [
    "¿Cómo registro un gasto fijo?",
    "¿Qué es el cashflow?",
    "Explicame las cuentas",
  ],
  "/cashflow": [
    "¿Cómo interpreto el cashflow?",
    "¿Por qué tengo flujo negativo?",
    "Explicame la proyección",
  ],
  "/resumen": [
    "¿Qué muestran estos números?",
    "¿Cómo mejorar mi rentabilidad?",
    "Comparame con meses anteriores",
  ],
  "/estados-resultados": [
    "Explicame el estado de resultados",
    "¿Cuál es mi resultado neto?",
    "¿Qué son los costos fijos vs variables?",
  ],
  "/cuadro-resumen": [
    "¿Cuáles son mis KPIs más importantes?",
    "¿Qué significa el ticket promedio?",
    "Analizá mi desempeño",
  ],
  "/clasificaciones": [
    "¿Para qué sirven las clasificaciones?",
    "¿Cómo organizo mis categorías?",
    "¿Qué métodos de pago conviene tener?",
  ],
};

const DEFAULT_PROMPTS = ["¿Cómo arranco?", "¿Cómo registro una venta?", "¿Cómo vengo este mes?"];

// Detecta soporte de Web Speech API
const hasSpeechRecognition = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasSpeechSynthesis = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export function AIAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "memory">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [noApiKey, setNoApiKey] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentPage = Object.entries(PAGE_LABELS).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? "";

  const isPOS = pathname.startsWith("/pos");

  // Auto-cerrar en POS (interfaz de foco total)
  useEffect(() => {
    if (isPOS) setOpen(false);
  }, [isPOS]);

  // Ref para el auto-saludo (se asigna después de que sendMessage esté definido)
  const autoGreetingFiredRef = useRef(false);

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Foco en el input al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{ role: "assistant", content: WELCOME }]);
      }
    }
  }, [open]);

  // TTS: leer respuesta en voz
  const speak = useCallback((text: string) => {
    if (!hasSpeechSynthesis() || !ttsEnabled) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/[#*`]/g, "");
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "es-AR";
    utt.rate = 1.05;
    utt.pitch = 1;
    // Busca voz en español si está disponible
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find((v) => v.lang.startsWith("es"));
    if (esVoice) utt.voice = esVoice;
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  // Parar TTS al cerrar
  useEffect(() => {
    if (!open && hasSpeechSynthesis()) window.speechSynthesis.cancel();
  }, [open]);

  // ── Memorias ──────────────────────────────────────────────────────────────
  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch {
      // silent
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    setDeletingId(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch(`/api/chat?id=${id}`, { method: "DELETE" });
    } catch {
      fetchMemories();
    } finally {
      setDeletingId(null);
    }
  }, [fetchMemories]);

  // Cargar memorias al cambiar a la pestaña de memoria
  useEffect(() => {
    if (activeTab === "memory") fetchMemories();
  }, [activeTab, fetchMemories]);

  // Enviar mensaje al API
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setNoApiKey(false);

    // Filtrar action messages — la API solo recibe chat messages
    const allMessages = [...messages, userMsg]
      .filter((m): m is ChatMessage => m.role !== "action")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, currentPage }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error?.includes("GROQ_API_KEY")) {
          setNoApiKey(true);
        }
        throw new Error(err.error || "Error al conectar con el asistente");
      }

      // Streaming
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullText };
          return updated;
        });
      }

      // ── Detectar y ejecutar bloque <accion> ──────────────────
      const actionMatch = fullText.match(/<accion>([\s\S]*?)<\/accion>/);
      if (actionMatch) {
        // Limpiar el bloque del texto visible
        const cleanText = fullText.replace(/\s*<accion>[\s\S]*?<\/accion>\s*/g, "").trim();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: cleanText } as ChatMessage;
          return updated;
        });

        try {
          const actionData = JSON.parse(actionMatch[1]) as Record<string, unknown>;
          const label = getActionLabel(actionData);

          // Acción navegar — client-side, sin fetch
          if (actionData.tipo === "navegar") {
            const ruta = actionData.ruta as string;
            const nombre = ROUTE_LABELS[ruta] ?? ruta;
            setMessages((prev) => [
              ...prev,
              { role: "action", status: "success", label: `Navegando a ${nombre}` } as ActionMessage,
            ]);
            setTimeout(() => router.push(ruta), 400);
            // eslint-disable-next-line no-empty
          } else {
          // Agregar card "running"
          setMessages((prev) => [
            ...prev,
            { role: "action", status: "running", label } as ActionMessage,
          ]);

          // Ejecutar
          const res = await fetch("/api/chat/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(actionData),
          });
          const result = await res.json() as Record<string, unknown>;

          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "action") {
              updated[updated.length - 1] = res.ok
                ? ({ role: "action", status: "success", label, detail: getSuccessDetail(actionData, result) } as ActionMessage)
                : ({ role: "action", status: "error", label, errorMsg: result.error as string } as ActionMessage);
            }
            return updated;
          });

          // Refrescar página si es creación (para que aparezca en listas)
          if (res.ok && actionData.tipo === "crear_producto") {
            router.refresh();
          }
          }
        } catch {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "action") {
              updated[updated.length - 1] = { ...last, status: "error", errorMsg: "Error al ejecutar" } as ActionMessage;
            }
            return updated;
          });
        }
      } else {
        if (fullText) speak(fullText);
      }

      // Refrescar memorias en background (puede que se hayan extraído nuevas)
      setTimeout(() => fetchMemories(), 2500);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, currentPage, speak, fetchMemories]);

  // Voice input
  const toggleListening = useCallback(() => {
    if (!hasSpeechRecognition()) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const rec: SpeechRecognition = new SpeechRec();
    rec.lang = "es-AR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [listening, sendMessage]);

  const resetChat = () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setMessages([{ role: "assistant", content: WELCOME }]);
    setInput("");
    setLoading(false);
  };

  // Auto-saludo diario: una vez por día, Costito dice buenos días
  // Definido después de sendMessage para poder llamarlo
  useEffect(() => {
    if (isPOS) return;
    if (autoGreetingFiredRef.current) return;
    const today = new Date().toISOString().split("T")[0];
    const lastGreeting = localStorage.getItem("costitoLastGreeting");
    if (lastGreeting === today) return;

    autoGreetingFiredRef.current = true;
    const timer = setTimeout(() => {
      localStorage.setItem("costitoLastGreeting", today);
      setOpen(true);
      // Esperar a que el panel abra y cargue el welcome message
      setTimeout(() => {
        sendMessage("Buenos días! Dame un resumen rápido de cómo está el negocio hoy.");
      }, 600);
    }, 2000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage]);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center justify-center w-13 h-13 rounded-full shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
          open && "rotate-12"
        )}
        style={{ width: 52, height: 52 }}
        title="Costito - Asistente IA"
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
      </button>

      {/* Panel de chat */}
      <div
        className={cn(
          "fixed bottom-20 right-5 z-40 flex flex-col bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 origin-bottom-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ width: 360, height: 520 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border rounded-t-2xl bg-primary text-primary-foreground">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex-1 leading-none">
            <p className="text-sm font-semibold">Costito</p>
            <p className="text-[11px] opacity-60 mt-0.5">
              {currentPage ? `Estás en ${currentPage}` : "Asistente IA"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* Tab switcher */}
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                activeTab === "chat"
                  ? "bg-white/20"
                  : "hover:bg-white/10 opacity-60"
              )}
              title="Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTab("memory")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                activeTab === "memory"
                  ? "bg-white/20"
                  : "hover:bg-white/10 opacity-60"
              )}
              title="Memorias"
            >
              <Brain className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-white/20 mx-0.5" />
            {activeTab === "chat" ? (
              <>
                <button
                  onClick={() => {
                    setTtsEnabled((v) => !v);
                    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title={ttsEnabled ? "Silenciar voz" : "Activar voz"}
                >
                  {ttsEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 opacity-80" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 opacity-40" />
                  )}
                </button>
                <button
                  onClick={resetChat}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Reiniciar conversación"
                >
                  <RotateCcw className="w-3.5 h-3.5 opacity-80" />
                </button>
              </>
            ) : (
              <button
                onClick={fetchMemories}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Actualizar memorias"
                disabled={memoriesLoading}
              >
                <RefreshCw className={cn("w-3.5 h-3.5 opacity-80", memoriesLoading && "animate-spin")} />
              </button>
            )}
          </div>
        </div>

        {/* ── CHAT TAB ── */}
        {activeTab === "chat" && (
          <>
            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {noApiKey && (
                <div className="p-3 bg-warning-muted rounded-lg text-xs text-warning-muted-foreground border border-warning/20"
                  style={{ background: "var(--warning-muted)", color: "var(--warning-muted-foreground)" }}>
                  <p className="font-semibold mb-1">Falta la API key de Groq</p>
                  <p>Conseguila gratis en <span className="font-mono">console.groq.com</span> y pegala en el <span className="font-mono">.env</span> como <span className="font-mono">GROQ_API_KEY</span></p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "action"
                      ? "justify-start"
                      : msg.role === "user"
                        ? "justify-end"
                        : "justify-start"
                  )}
                >
                  {msg.role === "action" ? (
                    <ActionCard action={msg} />
                  ) : (
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}
                    >
                      {/* Strip <accion> tag during streaming */}
                      {msg.content.replace(/<accion>[\s\S]*?(<\/accion>)?/g, "").trim().split("\n").map((line, j) => {
                        const formatted = line
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/^- /, "• ");
                        return (
                          <p
                            key={j}
                            className={j > 0 ? "mt-1" : ""}
                            dangerouslySetInnerHTML={{ __html: formatted }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick prompts contextuales (solo al inicio) */}
            {messages.length <= 1 && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {(
                  Object.entries(CONTEXTUAL_PROMPTS).find(([path]) =>
                    pathname.startsWith(path)
                  )?.[1] ?? DEFAULT_PROMPTS
                ).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border flex items-center gap-2">
              {hasSpeechRecognition() && (
                <button
                  onClick={toggleListening}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0",
                    listening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={listening ? "Parar de escuchar" : "Hablar"}
                >
                  {listening ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={listening ? "Escuchando..." : "Preguntá algo..."}
                disabled={loading || listening}
                className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground disabled:opacity-50"
              />

              <Button
                size="icon"
                className="w-8 h-8 rounded-full shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        )}

        {/* ── MEMORY TAB ── */}
        {activeTab === "memory" && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {memoriesLoading && memories.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                <Brain className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Todavía no guardé nada tuyo, Costito está atento.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  A medida que charlamos, voy aprendiendo cosas de tu negocio y las guardo acá.
                </p>
              </div>
            ) : (
              <MemoryList
                memories={memories}
                deletingId={deletingId}
                onDelete={deleteMemory}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Subcomponente: ActionCard ─────────────────────────────────────────────────

function ActionCard({ action }: { action: ActionMessage }) {
  const isRunning = action.status === "running";
  const isSuccess = action.status === "success";
  const isError = action.status === "error";

  return (
    <div
      className={cn(
        "w-full max-w-[92%] rounded-xl border px-3.5 py-3 text-sm transition-all duration-300",
        isRunning && "border-primary/30 bg-primary/5",
        isSuccess && "border-green-300 bg-green-50",
        isError && "border-red-200 bg-red-50"
      )}
    >
      <div className="flex items-center gap-2.5">
        {isRunning && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
        {isError && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
        {!isRunning && !isSuccess && !isError && <Zap className="w-3.5 h-3.5 text-primary shrink-0" />}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium leading-tight",
              isRunning && "text-primary",
              isSuccess && "text-green-700",
              isError && "text-red-600"
            )}
          >
            {isRunning ? action.label : isSuccess ? "¡Listo!" : "Error"}
          </p>
          {(action.detail || action.errorMsg) && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {action.detail || action.errorMsg}
            </p>
          )}
        </div>
      </div>
      {isRunning && (
        <div className="mt-2.5 h-0.5 rounded-full bg-primary/15 overflow-hidden">
          <div className="h-full w-2/5 bg-primary/60 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ── Subcomponente: lista de memorias agrupadas por categoría ──────────────────

const CATEGORY_LABELS: Record<string, string> = {
  negocio: "Negocio",
  productos: "Productos",
  preferencias: "Preferencias",
  finanzas: "Finanzas",
  contexto: "Contexto",
};

function MemoryList({
  memories,
  deletingId,
  onDelete,
}: {
  memories: Memory[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  const grouped = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const cat = m.category || "contexto";
    acc[cat] = acc[cat] || [];
    acc[cat].push(m);
    return acc;
  }, {});

  return (
    <div className="px-3 py-3 space-y-4">
      <p className="text-[11px] text-muted-foreground px-1">
        {memories.length} {memories.length === 1 ? "recuerdo guardado" : "recuerdos guardados"} · Se usan para personalizar mis respuestas
      </p>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1.5">
            {CATEGORY_LABELS[category] ?? category}
          </p>
          <div className="space-y-1">
            {items.map((mem) => (
              <div
                key={mem.id}
                className="group flex items-start gap-2 rounded-lg px-2.5 py-2 bg-muted hover:bg-accent/50 transition-colors"
              >
                <p className="flex-1 text-xs text-foreground leading-relaxed pt-px">
                  {mem.content}
                </p>
                <button
                  onClick={() => onDelete(mem.id)}
                  disabled={deletingId === mem.id}
                  className="shrink-0 mt-0.5 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Eliminar recuerdo"
                >
                  {deletingId === mem.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
