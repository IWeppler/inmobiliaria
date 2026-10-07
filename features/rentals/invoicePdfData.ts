import "server-only";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/types/supabase";
import { BRAND } from "@/lib/brand";
import { afipQrUrl, CBTE_LABELS, formatInvoiceNumber } from "@/features/rentals/invoicing";
import type { EmitterData, InvoiceData } from "@/features/rentals/pdf/InvoiceDocument";

type InvoiceRow = Database["public"]["Tables"]["rental_invoices"]["Row"];

// Datos para el PDF de una factura: emisor (variables AFIP_*), comprobante
// asociado si es nota de crédito y el QR de ARCA como imagen.
export async function invoicePdfProps(supabase: SupabaseClient<Database>, invoice: InvoiceRow): Promise<{ invoice: InvoiceData; emitter: EmitterData; qr: string }> {
  const { data: original } = invoice.credited_invoice_id
    ? await supabase.from("rental_invoices").select("cbte_tipo, pto_vta, cbte_nro").eq("id", invoice.credited_invoice_id).maybeSingle()
    : { data: null };
  const cuit = process.env.AFIP_CUIT?.replace(/\D/g, "") ?? "";
  const qrUrl = afipQrUrl({
    date: invoice.issued_on, cuit, ptoVta: invoice.pto_vta, cbteTipo: invoice.cbte_tipo, cbteNro: invoice.cbte_nro,
    total: Number(invoice.total), currency: invoice.currency, rate: Number(invoice.exchange_rate),
    docTipo: invoice.receptor_doc_tipo, docNro: invoice.receptor_doc_nro, cae: invoice.cae,
  });
  return {
    qr: await QRCode.toDataURL(qrUrl, { margin: 0, width: 360 }),
    emitter: {
      name: process.env.AFIP_RAZON_SOCIAL ?? BRAND.name,
      cuit,
      iva: process.env.AFIP_IVA_CONDITION ?? "",
      address: process.env.AFIP_DOMICILIO ?? BRAND.address,
      iibb: process.env.AFIP_IIBB ?? null,
      startDate: process.env.AFIP_INICIO_ACTIVIDADES ?? null,
    },
    invoice: {
      ...invoice,
      exchange_rate: Number(invoice.exchange_rate), net: Number(invoice.net), vat: Number(invoice.vat), total: Number(invoice.total),
      associated: original ? `${CBTE_LABELS[original.cbte_tipo]} ${formatInvoiceNumber(original.pto_vta, original.cbte_nro)}` : null,
    },
  };
}
