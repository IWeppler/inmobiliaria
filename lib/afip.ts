import "server-only";
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Facturación electrónica ARCA (ex AFIP), conexión directa a los web
// services oficiales: WSAA (autenticación con el certificado) y WSFEv1
// (CAE). El certificado y la clave privada viven solo en variables de
// entorno; no se guardan en la base ni pasan por terceros.
//
//   AFIP_ENV            HOMOLOGACION (default) | PRODUCCION
//   AFIP_CUIT           CUIT de la inmobiliaria, solo dígitos
//   AFIP_PTO_VTA        punto de venta habilitado para web services
//   AFIP_IVA_CONDITION  RI | MONOTRIBUTO
//   AFIP_CERT           certificado PEM (texto o base64)
//   AFIP_KEY            clave privada PEM (texto o base64)

export type AfipEnvironment = "HOMOLOGACION" | "PRODUCCION";

const URLS = {
  HOMOLOGACION: { wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms", wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx" },
  PRODUCCION: { wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms", wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx" },
};

export class AfipError extends Error {}

function pem(value: string | undefined) {
  if (!value) return null;
  const text = value.includes("-----BEGIN") ? value : Buffer.from(value, "base64").toString("utf8");
  return text.replace(/\\n/g, "\n");
}

export function afipConfig() {
  const environment: AfipEnvironment = process.env.AFIP_ENV === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION";
  const cuit = process.env.AFIP_CUIT?.replace(/\D/g, "");
  const ptoVta = Number(process.env.AFIP_PTO_VTA);
  const iva = process.env.AFIP_IVA_CONDITION === "RI" ? "RI" : process.env.AFIP_IVA_CONDITION === "MONOTRIBUTO" ? "MONOTRIBUTO" : null;
  const cert = pem(process.env.AFIP_CERT);
  const key = pem(process.env.AFIP_KEY);
  if (!cuit || cuit.length !== 11 || !Number.isInteger(ptoVta) || ptoVta < 1 || !iva || !cert || !key) return null;
  return { environment, cuit, ptoVta, iva: iva as "RI" | "MONOTRIBUTO", cert, key, urls: URLS[environment] };
}
export type AfipConfig = NonNullable<ReturnType<typeof afipConfig>>;

const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });

async function soap(url: string, action: string, envelope: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: action },
    body: envelope,
    cache: "no-store",
  });
  const text = await res.text();
  const doc = parser.parse(text);
  const fault = doc?.Envelope?.Body?.Fault;
  if (fault) throw new AfipError(String(fault.faultstring ?? "Error SOAP de ARCA"));
  if (!res.ok) throw new AfipError(`ARCA respondió HTTP ${res.status}`);
  return doc.Envelope.Body;
}

const esc = (v: string | number) => String(v).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// === WSAA ===

function signTicketRequest(config: AfipConfig, service: string) {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const tra = `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(now / 1000)}</uniqueId><generationTime>${iso(now - 10 * 60_000)}</generationTime><expirationTime>${iso(now + 10 * 60_000)}</expirationTime></header><service>${service}</service></loginTicketRequest>`;

  const cert = forge.pki.certificateFromPem(config.cert);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(config.key),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

// Ticket de acceso cacheado: WSAA rechaza pedir otro mientras el anterior
// sigue vigente, así que se guarda hasta 10 min antes de que venza.
async function accessTicket(config: AfipConfig, service = "wsfe") {
  const { data: cached } = await supabaseAdmin.from("afip_tokens").select("token, sign, expires_at")
    .eq("service", service).eq("environment", config.environment).maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() - Date.now() > 10 * 60_000) return cached;

  const cms = signTicketRequest(config, service);
  const body = await soap(config.urls.wsaa, "",
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`);
  const ticket = parser.parse(String(body.loginCmsResponse?.loginCmsReturn ?? ""))?.loginTicketResponse;
  const token = ticket?.credentials?.token;
  const sign = ticket?.credentials?.sign;
  const expires = ticket?.header?.expirationTime;
  if (!token || !sign || !expires) throw new AfipError("ARCA no devolvió el ticket de acceso.");
  const row = { service, environment: config.environment, token: String(token), sign: String(sign), expires_at: new Date(String(expires)).toISOString() };
  await supabaseAdmin.from("afip_tokens").upsert(row);
  return row;
}

// === WSFEv1 ===

const FE_NS = "http://ar.gov.afip.dif.FEV1/";

async function wsfe(config: AfipConfig, method: string, inner: string) {
  const { token, sign } = await accessTicket(config);
  const auth = `<ar:Auth><ar:Token>${esc(token)}</ar:Token><ar:Sign>${esc(sign)}</ar:Sign><ar:Cuit>${config.cuit}</ar:Cuit></ar:Auth>`;
  const body = await soap(config.urls.wsfe, `${FE_NS}${method}`,
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${FE_NS}"><soap:Body><ar:${method}>${auth}${inner}</ar:${method}></soap:Body></soap:Envelope>`);
  const result = body?.[`${method}Response`]?.[`${method}Result`];
  if (!result) throw new AfipError(`Respuesta vacía de ARCA (${method}).`);
  return result;
}

const errorsOf = (result: { Errors?: { Err?: unknown } }) =>
  asArray(result.Errors?.Err as { Code: string; Msg: string } | { Code: string; Msg: string }[] | undefined);

export async function lastInvoiceNumber(config: AfipConfig, cbteTipo: number): Promise<number> {
  const result = await wsfe(config, "FECompUltimoAutorizado", `<ar:PtoVta>${config.ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`);
  const errors = errorsOf(result);
  if (errors.length) throw new AfipError(errors.map((e) => `${e.Code}: ${e.Msg}`).join(" · "));
  return Number(result.CbteNro ?? 0);
}

export async function dollarRate(config: AfipConfig): Promise<number> {
  const result = await wsfe(config, "FEParamGetCotizacion", "<ar:MonId>DOL</ar:MonId>");
  const rate = Number(result.ResultGet?.MonCotiz);
  if (!rate) throw new AfipError("ARCA no devolvió la cotización del dólar.");
  return rate;
}

export type CaeRequest = {
  cbteTipo: number;
  date: string; // YYYY-MM-DD
  docTipo: number;
  docNro: string;
  ivaReceptorId: number;
  net: number;
  vat: number;
  total: number;
  currency: "ARS" | "USD";
  rate: number;
  serviceFrom: string;
  serviceTo: string;
  associated?: { cbteTipo: number; ptoVta: number; nro: number; date: string };
};

const ymd8 = (date: string) => date.replaceAll("-", "");
const amount = (n: number) => n.toFixed(2);

// Pide el CAE para el próximo número. Si otro emitió en el medio (número no
// correlativo) se reintenta una vez con el número actualizado.
export async function requestCae(config: AfipConfig, req: CaeRequest): Promise<{ cae: string; caeDue: string; cbteNro: number; observations: string[] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const nro = (await lastInvoiceNumber(config, req.cbteTipo)) + 1;
    const foreign = req.currency === "USD";
    const iva = req.vat > 0
      ? `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${amount(req.net)}</ar:BaseImp><ar:Importe>${amount(req.vat)}</ar:Importe></ar:AlicIva></ar:Iva>`
      : "";
    const associated = req.associated
      ? `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${req.associated.cbteTipo}</ar:Tipo><ar:PtoVta>${req.associated.ptoVta}</ar:PtoVta><ar:Nro>${req.associated.nro}</ar:Nro><ar:Cuit>${config.cuit}</ar:Cuit><ar:CbteFch>${ymd8(req.associated.date)}</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>`
      : "";
    // El orden de los elementos es el del WSDL (secuencia estricta).
    const detail = [
      `<ar:Concepto>2</ar:Concepto>`,
      `<ar:DocTipo>${req.docTipo}</ar:DocTipo>`,
      `<ar:DocNro>${esc(req.docNro)}</ar:DocNro>`,
      `<ar:CbteDesde>${nro}</ar:CbteDesde>`,
      `<ar:CbteHasta>${nro}</ar:CbteHasta>`,
      `<ar:CbteFch>${ymd8(req.date)}</ar:CbteFch>`,
      `<ar:ImpTotal>${amount(req.total)}</ar:ImpTotal>`,
      `<ar:ImpTotConc>0.00</ar:ImpTotConc>`,
      `<ar:ImpNeto>${amount(req.net)}</ar:ImpNeto>`,
      `<ar:ImpOpEx>0.00</ar:ImpOpEx>`,
      `<ar:ImpTrib>0.00</ar:ImpTrib>`,
      `<ar:ImpIVA>${amount(req.vat)}</ar:ImpIVA>`,
      `<ar:FchServDesde>${ymd8(req.serviceFrom)}</ar:FchServDesde>`,
      `<ar:FchServHasta>${ymd8(req.serviceTo)}</ar:FchServHasta>`,
      `<ar:FchVtoPago>${ymd8(req.date)}</ar:FchVtoPago>`,
      `<ar:MonId>${foreign ? "DOL" : "PES"}</ar:MonId>`,
      `<ar:MonCotiz>${foreign ? req.rate.toFixed(6) : "1"}</ar:MonCotiz>`,
      foreign ? `<ar:CanMisMonExt>N</ar:CanMisMonExt>` : "",
      `<ar:CondicionIVAReceptorId>${req.ivaReceptorId}</ar:CondicionIVAReceptorId>`,
      associated,
      iva,
    ].join("");

    const result = await wsfe(config, "FECAESolicitar",
      `<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${config.ptoVta}</ar:PtoVta><ar:CbteTipo>${req.cbteTipo}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${detail}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`);

    const errors = errorsOf(result);
    const det = asArray(result.FeDetResp?.FECAEDetResponse)[0] as
      | { Resultado?: string; CAE?: string; CAEFchVto?: string; Observaciones?: { Obs?: unknown } } | undefined;
    const observations = asArray(det?.Observaciones?.Obs as { Code: string; Msg: string } | { Code: string; Msg: string }[] | undefined)
      .map((o) => `${o.Code}: ${o.Msg}`);

    if (det?.Resultado === "A" && det.CAE && det.CAEFchVto) {
      const due = String(det.CAEFchVto);
      return { cae: String(det.CAE), caeDue: `${due.slice(0, 4)}-${due.slice(4, 6)}-${due.slice(6, 8)}`, cbteNro: nro, observations };
    }
    // 10016: el número no es el siguiente (otro emitió en el medio).
    const outOfSequence = [...errors.map((e) => e.Code), ...observations].some((c) => String(c).startsWith("10016"));
    if (outOfSequence && attempt === 0) continue;
    const messages = [...errors.map((e) => `${e.Code}: ${e.Msg}`), ...observations];
    throw new AfipError(messages.length ? messages.join(" · ") : "ARCA rechazó el comprobante.");
  }
  throw new AfipError("No se pudo obtener el número de comprobante.");
}
