"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClientServer } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ymdInAppTz } from "@/lib/dates";
import { afipConfig, AfipError, dollarRate, requestCae } from "@/lib/afip";
import type { ActionResult } from "@/features/rentals/actions";
import { formatPeriod } from "@/features/rentals/logic";
import {
  CBTE_LABELS, IVA_RECEPTOR_ID, formatInvoiceNumber, invoiceType, receptorDocument, receptorProblem, shareFees, splitVat,
  type IvaCondition,
} from "@/features/rentals/invoicing";

// Facturación ARCA de honorarios (E4.19). Se lee con la sesión del agente
// (RLS: solo liquidaciones de sus contratos) y la factura con CAE la
// inserta el servidor con service role.

type ShareRow = {
  id: string; share_pct: number; is_primary: boolean;
  contact: { id: string; full_name: string; document: string | null; iva_condition: string | null } | null;
};

const lastDayOfMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const afipMessage = (error: unknown) =>
  error instanceof AfipError ? `ARCA: ${error.message}` : "No se pudo conectar con ARCA. Probá de nuevo en unos minutos.";

export async function issueSettlementInvoicesAction(settlementId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(settlementId).success) return { success: false, message: "Liquidación inválida." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const config = afipConfig();
  if (!config) return { success: false, message: "La facturación electrónica no está configurada (variables AFIP_*)." };

  const { data: settlement } = await supabase.from("rental_settlements")
    .select("id, contract_id, period, commission_amount, currency, contract:rental_contracts(property:properties(title))")
    .eq("id", settlementId).maybeSingle();
  if (!settlement) return { success: false, message: "Liquidación no encontrada." };
  const commission = Number(settlement.commission_amount);
  if (!(commission > 0)) return { success: false, message: "La liquidación no tiene honorarios para facturar." };

  const [{ data: sharesRaw }, { data: existing }] = await Promise.all([
    supabase.from("rental_settlement_shares")
      .select("id, share_pct, is_primary, contact:rental_contacts(id, full_name, document, iva_condition)").eq("settlement_id", settlementId),
    supabase.from("rental_invoices").select("share_id").eq("settlement_id", settlementId).eq("kind", "FACTURA").eq("voided", false),
  ]);
  const shares = ((sharesRaw ?? []) as unknown as ShareRow[]).filter((s) => s.contact);
  const invoiced = new Set((existing ?? []).map((i) => i.share_id));
  const pending = shareFees(commission, shares.map((s) => ({ ...s, share_pct: Number(s.share_pct) }))).filter((s) => !invoiced.has(s.id) && s.fee > 0);
  if (!pending.length) return { success: false, message: "Los honorarios de esta liquidación ya están facturados." };

  // Se valida a todos los titulares antes de pedir el primer CAE.
  for (const share of pending) {
    const problem = receptorProblem({ name: share.contact!.full_name, iva: share.contact!.iva_condition as IvaCondition | null, document: share.contact!.document }, config.iva);
    if (problem) return { success: false, message: problem };
  }

  const today = ymdInAppTz();
  const property = (settlement.contract as unknown as { property: { title: string } | null } | null)?.property?.title ?? "Propiedad";
  const description = `Honorarios de administración - ${property} - ${formatPeriod(settlement.period)}`;
  const currency = settlement.currency === "USD" ? "USD" : "ARS";
  let issued = 0;

  try {
    const rate = currency === "USD" ? await dollarRate(config) : 1;
    for (const share of pending) {
      const contact = share.contact!;
      const iva = contact.iva_condition as IvaCondition;
      const cbteTipo = invoiceType(config.iva, iva, "FACTURA");
      const doc = receptorDocument(contact.document);
      const { net, vat } = splitVat(share.fee, cbteTipo);
      const cae = await requestCae(config, {
        cbteTipo, date: today, docTipo: doc.tipo, docNro: doc.nro, ivaReceptorId: IVA_RECEPTOR_ID[iva],
        net, vat, total: share.fee, currency, rate, serviceFrom: settlement.period, serviceTo: lastDayOfMonth(settlement.period),
      });
      const { error } = await supabaseAdmin.from("rental_invoices").insert({
        settlement_id: settlement.id, share_id: share.id, contact_id: contact.id, kind: "FACTURA",
        cbte_tipo: cbteTipo, pto_vta: config.ptoVta, cbte_nro: cae.cbteNro, environment: config.environment, issued_on: today,
        receptor_name: contact.full_name, receptor_doc_tipo: doc.tipo, receptor_doc_nro: doc.nro, receptor_iva: iva,
        description, currency, exchange_rate: rate, net, vat, total: share.fee,
        service_from: settlement.period, service_to: lastDayOfMonth(settlement.period),
        cae: cae.cae, cae_due: cae.caeDue, created_by: user.id,
      });
      // El CAE ya existe en ARCA: si no se pudo guardar hay que registrarlo a mano.
      if (error) {
        console.error("[afip] CAE sin guardar", { cae: cae.cae, nro: cae.cbteNro, cbteTipo, error: error.message });
        return { success: false, message: `ARCA autorizó ${CBTE_LABELS[cbteTipo]} ${formatInvoiceNumber(config.ptoVta, cae.cbteNro)} (CAE ${cae.cae}) pero no se pudo guardar: avisá al administrador.` };
      }
      issued += 1;
    }
  } catch (error) {
    revalidatePath(`/dashboard/alquileres/${settlement.contract_id}/liquidacion/${settlement.id}`);
    const done = issued ? `Se emitieron ${issued} de ${pending.length}. ` : "";
    return { success: false, message: `${done}${afipMessage(error)}` };
  }

  revalidatePath(`/dashboard/alquileres/${settlement.contract_id}/liquidacion/${settlement.id}`);
  revalidatePath(`/dashboard/alquileres/${settlement.contract_id}`);
  return { success: true, message: issued === 1 ? "Factura emitida." : `${issued} facturas emitidas.` };
}

// Anula una factura con una nota de crédito por el mismo importe.
export async function creditInvoiceAction(invoiceId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(invoiceId).success) return { success: false, message: "Factura inválida." };
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No autenticado" };
  const config = afipConfig();
  if (!config) return { success: false, message: "La facturación electrónica no está configurada (variables AFIP_*)." };

  const { data: invoice } = await supabase.from("rental_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.kind !== "FACTURA") return { success: false, message: "Factura no encontrada." };
  if (invoice.voided) return { success: false, message: "La factura ya fue anulada." };
  if (invoice.environment !== config.environment) return { success: false, message: "La factura es de otro ambiente de ARCA." };

  const cbteTipo = ({ 1: 3, 6: 8, 11: 13 } as Record<number, number>)[invoice.cbte_tipo];
  if (!cbteTipo) return { success: false, message: "Tipo de comprobante no anulable." };
  const today = ymdInAppTz();
  const iva = invoice.receptor_iva as IvaCondition;

  try {
    const rate = invoice.currency === "USD" ? await dollarRate(config) : 1;
    const cae = await requestCae(config, {
      cbteTipo, date: today, docTipo: invoice.receptor_doc_tipo, docNro: invoice.receptor_doc_nro, ivaReceptorId: IVA_RECEPTOR_ID[iva],
      net: Number(invoice.net), vat: Number(invoice.vat), total: Number(invoice.total), currency: invoice.currency as "ARS" | "USD", rate,
      serviceFrom: invoice.service_from ?? today, serviceTo: invoice.service_to ?? today,
      associated: { cbteTipo: invoice.cbte_tipo, ptoVta: invoice.pto_vta, nro: invoice.cbte_nro, date: invoice.issued_on },
    });
    const { error } = await supabaseAdmin.from("rental_invoices").insert({
      settlement_id: invoice.settlement_id, share_id: invoice.share_id, contact_id: invoice.contact_id, kind: "NOTA_CREDITO",
      cbte_tipo: cbteTipo, pto_vta: config.ptoVta, cbte_nro: cae.cbteNro, environment: config.environment, issued_on: today,
      receptor_name: invoice.receptor_name, receptor_doc_tipo: invoice.receptor_doc_tipo, receptor_doc_nro: invoice.receptor_doc_nro,
      receptor_iva: invoice.receptor_iva, description: `Anula ${CBTE_LABELS[invoice.cbte_tipo]} ${formatInvoiceNumber(invoice.pto_vta, invoice.cbte_nro)}`,
      currency: invoice.currency, exchange_rate: rate, net: invoice.net, vat: invoice.vat, total: invoice.total,
      service_from: invoice.service_from, service_to: invoice.service_to, cae: cae.cae, cae_due: cae.caeDue,
      credited_invoice_id: invoice.id, created_by: user.id,
    });
    if (error) {
      console.error("[afip] NC sin guardar", { cae: cae.cae, nro: cae.cbteNro, error: error.message });
      return { success: false, message: `ARCA autorizó la nota de crédito (CAE ${cae.cae}) pero no se pudo guardar: avisá al administrador.` };
    }
    await supabaseAdmin.from("rental_invoices").update({ voided: true }).eq("id", invoice.id);
  } catch (error) {
    return { success: false, message: afipMessage(error) };
  }
  revalidatePath("/dashboard/alquileres", "layout");
  return { success: true, message: "Factura anulada con nota de crédito. Ya podés volver a facturar." };
}
