"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AfipConfigFormProps {
  accountId: string;
}

export function AfipConfigForm({ accountId }: AfipConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testResult, setTestResult] = useState<any>(null);

  const [cuit, setCuit] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("1");
  const [accessToken, setAccessToken] = useState("");
  const [cert, setCert] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [isProduction, setIsProduction] = useState(false);

  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    trpc.facturacion.getConfig
      .query({ accountId })
      .then((config) => {
        if (config) {
          setCuit(config.cuit);
          setPuntoVenta(String(config.puntoVenta));
          setAccessToken(config.accessToken);
          setIsProduction(config.isProduction);
          setIsConfigured(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  const handleSave = async () => {
    if (!cuit || !accessToken) {
      toast.error("CUIT y Access Token son obligatorios");
      return;
    }

    setSaving(true);
    try {
      await trpc.facturacion.saveConfig.mutate({
        accountId,
        cuit,
        puntoVenta: parseInt(puntoVenta) || 1,
        accessToken,
        cert: cert || null,
        privateKey: privateKey || null,
        isProduction,
      });
      setIsConfigured(true);
      toast.success("Configuracion AFIP guardada");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al guardar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await trpc.facturacion.testConnection.mutate({
        accountId,
      });
      setTestResult(result);
      if (result.success) {
        toast.success("Conexion exitosa con AFIP");
      } else {
        toast.error(`Error de conexion: ${result.error}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al probar conexion";
      toast.error(message);
      setTestResult({ success: false, error: message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        Cargando configuracion...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge
          variant={isConfigured ? "default" : "outline"}
          className={
            isConfigured
              ? "bg-green-100 text-green-800"
              : "text-orange-600 border-orange-300"
          }
        >
          {isConfigured ? "Configurado" : "Sin configurar"}
        </Badge>
        <Badge variant={isProduction ? "default" : "secondary"}>
          {isProduction ? "Produccion" : "Testing"}
        </Badge>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">Como configurar AFIP:</p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>
            Registrate en{" "}
            <a
              href="https://afipsdk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              afipsdk.com
            </a>{" "}
            y obtene tu Access Token
          </li>
          <li>Ingresa tu CUIT (sin guiones)</li>
          <li>
            Para testing: usa el entorno de pruebas (no necesitas certificado)
          </li>
          <li>
            Para produccion: subi tu certificado y clave privada de AFIP
          </li>
        </ol>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cuit">
              CUIT <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cuit"
              placeholder="20409378472"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              maxLength={13}
            />
            <p className="text-xs text-gray-400 mt-1">
              Sin guiones (ej: 20409378472)
            </p>
          </div>
          <div>
            <Label htmlFor="puntoVenta">Punto de Venta</Label>
            <Input
              id="puntoVenta"
              type="number"
              min="1"
              max="99999"
              value={puntoVenta}
              onChange={(e) => setPuntoVenta(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Numero de punto de venta habilitado en AFIP
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="accessToken">
            Access Token (AfipSDK) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="accessToken"
            type="password"
            placeholder="Tu access token de afipsdk.com"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="cert">
            Certificado X.509 (PEM)
            <span className="text-xs text-gray-400 ml-2">
              Solo para produccion
            </span>
          </Label>
          <textarea
            id="cert"
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        <div>
          <Label htmlFor="privateKey">
            Clave Privada (PEM)
            <span className="text-xs text-gray-400 ml-2">
              Solo para produccion
            </span>
          </Label>
          <textarea
            id="privateKey"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isProduction"
            checked={isProduction}
            onChange={(e) => setIsProduction(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="isProduction">
            Modo Produccion
            <span className="text-xs text-gray-400 ml-2">
              (requiere certificado y clave)
            </span>
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Configuracion"}
        </Button>
        {isConfigured && (
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? "Probando..." : "Probar Conexion"}
          </Button>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            testResult.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {testResult.success ? (
            <div className="space-y-1">
              <p className="font-semibold text-green-800">
                Conexion exitosa
              </p>
              <div className="grid grid-cols-3 gap-2 text-green-700">
                <div>
                  AppServer:{" "}
                  <span className="font-mono">{testResult.appServer}</span>
                </div>
                <div>
                  DbServer:{" "}
                  <span className="font-mono">{testResult.dbServer}</span>
                </div>
                <div>
                  AuthServer:{" "}
                  <span className="font-mono">{testResult.authServer}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-red-800">Error de conexion</p>
              <p className="text-red-600 mt-1">{testResult.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
