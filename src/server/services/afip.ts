/**
 * AFIP Service — Wrapper around @afipsdk/afip.js
 *
 * Handles WSAA authentication and WSFE (electronic billing) operations.
 * All SOAP complexity is abstracted by the AfipSDK cloud service.
 *
 * @see https://docs.afipsdk.com/
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Afip = require("@afipsdk/afip.js");

// ============================================================
// Constants
// ============================================================

/** AFIP invoice type codes */
export const INVOICE_TYPES = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13,
} as const;

/** Human-readable names for invoice types */
export const INVOICE_TYPE_NAMES: Record<number, string> = {
  1: "Factura A",
  2: "Nota de Debito A",
  3: "Nota de Credito A",
  6: "Factura B",
  7: "Nota de Debito B",
  8: "Nota de Credito B",
  11: "Factura C",
  12: "Nota de Debito C",
  13: "Nota de Credito C",
};

/** AFIP document type codes */
export const DOC_TYPES = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  SIN_IDENTIFICAR: 99,
} as const;

export const DOC_TYPE_NAMES: Record<number, string> = {
  80: "CUIT",
  86: "CUIL",
  96: "DNI",
  99: "Consumidor Final",
};

/** IVA aliquot codes */
export const IVA_ALIQUOTS = {
  IVA_0: 3,
  IVA_10_5: 4,
  IVA_21: 5,
  IVA_27: 6,
  IVA_5: 8,
  IVA_2_5: 9,
} as const;

// ============================================================
// Helpers
// ============================================================

/**
 * Format invoice number as XXXX-XXXXXXXX
 */
export function formatInvoiceNumber(
  puntoVenta: number,
  invoiceNumber: number
): string {
  return `${String(puntoVenta).padStart(4, "0")}-${String(invoiceNumber).padStart(8, "0")}`;
}

/**
 * Format date for AFIP (YYYYMMDD)
 */
export function formatDateForAfip(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Determine the invoice type based on account tax status and buyer document
 *
 * - Monotributista → Factura C (11)
 * - RI + buyer has CUIT → Factura A (1)
 * - RI + buyer is consumer → Factura B (6)
 */
export function determineInvoiceType(
  accountTaxStatus: string,
  buyerDocTipo: number
): number {
  if (accountTaxStatus === "monotributista") {
    return INVOICE_TYPES.FACTURA_C;
  }
  // RI
  if (buyerDocTipo === DOC_TYPES.CUIT) {
    return INVOICE_TYPES.FACTURA_A;
  }
  return INVOICE_TYPES.FACTURA_B;
}

// ============================================================
// AFIP Client Factory
// ============================================================

export type AfipConfig = {
  cuit: string;
  accessToken: string;
  cert?: string | null;
  privateKey?: string | null;
  isProduction: boolean;
};

/**
 * Create an AFIP SDK client instance
 */
export function createAfipClient(config: AfipConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    CUIT: config.cuit,
    access_token: config.accessToken,
    production: config.isProduction,
  };

  if (config.cert) options.cert = config.cert;
  if (config.privateKey) options.key = config.privateKey;

  return new Afip(options);
}

// ============================================================
// AFIP Operations
// ============================================================

/**
 * Test AFIP server connectivity
 */
export async function testAfipConnection(
  config: AfipConfig
): Promise<{ AppServer: string; DbServer: string; AuthServer: string }> {
  const afip = createAfipClient(config);
  return afip.ElectronicBilling.getServerStatus();
}

/**
 * Get the last voucher number for a given sales point and type
 */
export async function getLastVoucherNumber(
  config: AfipConfig,
  puntoVenta: number,
  invoiceType: number
): Promise<number> {
  const afip = createAfipClient(config);
  return afip.ElectronicBilling.getLastVoucher(puntoVenta, invoiceType);
}

/**
 * Get available sales points
 */
export async function getSalesPoints(
  config: AfipConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const afip = createAfipClient(config);
  return afip.ElectronicBilling.getSalesPoints();
}

/**
 * Create the next voucher (auto-increments number)
 */
export async function createNextVoucher(
  config: AfipConfig,
  data: {
    invoiceType: number;
    puntoVenta: number;
    concepto: number; // 1=Products, 2=Services, 3=Both
    docTipo: number;
    docNro: string | number;
    invoiceDate: Date;
    netAmount: number;
    exemptAmount: number;
    ivaAmount: number;
    tributesAmount: number;
    totalAmount: number;
    ivaRate?: number; // default 21
  }
): Promise<{
  CAE: string;
  CAEFchVto: string;
  voucherNumber: number;
}> {
  const afip = createAfipClient(config);

  // Build AFIP request data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const voucherData: any = {
    CbteTipo: data.invoiceType,
    PtoVta: data.puntoVenta,
    Concepto: data.concepto,
    DocTipo: data.docTipo,
    DocNro: data.docTipo === DOC_TYPES.SIN_IDENTIFICAR ? 0 : data.docNro,
    CbteFch: formatDateForAfip(data.invoiceDate),
    ImpTotal: round2(data.totalAmount),
    ImpTotConc: 0, // Non-taxed amount (not used in most cases)
    ImpNeto: round2(data.netAmount),
    ImpOpEx: round2(data.exemptAmount),
    ImpIVA: round2(data.ivaAmount),
    ImpTrib: round2(data.tributesAmount),
    MonId: "PES",
    MonCotiz: 1,
  };

  // Service dates (only for concepto 2 or 3)
  if (data.concepto === 2 || data.concepto === 3) {
    voucherData.FchServDesde = formatDateForAfip(data.invoiceDate);
    voucherData.FchServHasta = formatDateForAfip(data.invoiceDate);
    voucherData.FchVtoPago = formatDateForAfip(data.invoiceDate);
  }

  // IVA array — required for Factura A and B (not C)
  if (
    data.ivaAmount > 0 &&
    data.invoiceType !== INVOICE_TYPES.FACTURA_C &&
    data.invoiceType !== INVOICE_TYPES.NOTA_DEBITO_C &&
    data.invoiceType !== INVOICE_TYPES.NOTA_CREDITO_C
  ) {
    const aliquotId =
      data.ivaRate === 10.5
        ? IVA_ALIQUOTS.IVA_10_5
        : data.ivaRate === 27
          ? IVA_ALIQUOTS.IVA_27
          : IVA_ALIQUOTS.IVA_21; // default 21%

    voucherData.Iva = [
      {
        Id: aliquotId,
        BaseImp: round2(data.netAmount),
        Importe: round2(data.ivaAmount),
      },
    ];
  }

  const result = await afip.ElectronicBilling.createNextVoucher(voucherData);

  return {
    CAE: result.CAE,
    CAEFchVto: result.CAEFchVto,
    voucherNumber: result.voucherNumber,
  };
}

/**
 * Get complete voucher info from AFIP
 */
export async function getVoucherInfo(
  config: AfipConfig,
  number: number,
  puntoVenta: number,
  invoiceType: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const afip = createAfipClient(config);
  return afip.ElectronicBilling.getVoucherInfo(
    number,
    puntoVenta,
    invoiceType
  );
}

// ============================================================
// Utility
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
