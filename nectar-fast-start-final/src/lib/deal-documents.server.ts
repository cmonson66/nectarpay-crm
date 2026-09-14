/**
 * Generates the NectarPay deal paperwork (trial agreement, purchase agreement,
 * invoice) as branded PDFs and files them against the prospect.
 *
 * Server-only: pulls deal/lead/device/rep rows, renders with pdf-lib, uploads to
 * the private `lead-documents` bucket, and records a `lead_documents` row.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { purchaseAgreementSections, trialAgreementSections } from "@/lib/agreement-terms";


export type DealDocumentKind = "trial_agreement" | "purchase_agreement" | "invoice";

type Db = SupabaseClient<Database>;

const NAVY = rgb(0.055, 0.094, 0.176);
const HONEY = rgb(0.941, 0.706, 0.161);
const INK = rgb(0.17, 0.21, 0.28);
const MUTED = rgb(0.46, 0.51, 0.58);
const HAIRLINE = rgb(0.85, 0.87, 0.9);
const PANEL = rgb(0.96, 0.97, 0.98);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 62;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 86;
const BODY_TOP = PAGE_H - HEADER_H - 44;
const BODY_BOTTOM = 92;

const DOC_TITLE: Record<DealDocumentKind, string> = {
  trial_agreement: "Trial Terminal Agreement",
  purchase_agreement: "Purchase Agreement",
  invoice: "Invoice",
};

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const isoDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const dateTime = (iso: string) =>
  `${longDate(iso)} at ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

/** Word-wraps to a pixel width using the real font metrics. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

type Doc = {
  pdf: PDFDocument;
  fonts: Fonts;
  kind: DealDocumentKind;
  subtitle: string;
  page: PDFPage;
  y: number;
};

/** Diagonal NectarPay wordmark, repeated behind the content. */
function drawWatermark(page: PDFPage, fonts: Fonts) {
  const size = 58;
  const rows = [
    { x: 108, y: 250 },
    { x: 62, y: 430 },
    { x: 152, y: 600 },
  ];
  for (const row of rows) {
    page.drawText("Nectar", {
      x: row.x,
      y: row.y,
      size,
      font: fonts.bold,
      color: NAVY,
      opacity: 0.05,
      rotate: degrees(32),
    });
    const offset = fonts.bold.widthOfTextAtSize("Nectar", size);
    page.drawText("Pay", {
      // Continue the wordmark along the same 32° baseline.
      x: row.x + offset * Math.cos((32 * Math.PI) / 180),
      y: row.y + offset * Math.sin((32 * Math.PI) / 180),
      size,
      font: fonts.bold,
      color: HONEY,
      opacity: 0.16,
      rotate: degrees(32),
    });
  }
}

function drawHeaderBand(page: PDFPage, fonts: Fonts, kind: DealDocumentKind, subtitle: string) {
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: HONEY });

  page.drawText("Nectar", { x: MARGIN, y: PAGE_H - 46, size: 20, font: fonts.bold, color: WHITE });
  page.drawText("Pay", {
    x: MARGIN + fonts.bold.widthOfTextAtSize("Nectar", 20),
    y: PAGE_H - 46,
    size: 20,
    font: fonts.bold,
    color: HONEY,
  });
  page.drawText(DOC_TITLE[kind], {
    x: MARGIN,
    y: PAGE_H - 64,
    size: 9,
    font: fonts.regular,
    color: rgb(0.78, 0.82, 0.88),
  });

  const right = (text: string, y: number, font: PDFFont, size: number, color = rgb(0.78, 0.82, 0.88)) => {
    page.drawText(text, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(text, size), y, size, font, color });
  };
  right(subtitle, PAGE_H - 46, fonts.bold, 8.5, HONEY);
  right("nectar-pay.com", PAGE_H - 64, fonts.regular, 8.5);
}

function newPage(doc: Doc) {
  const page = doc.pdf.addPage([PAGE_W, PAGE_H]);
  drawWatermark(page, doc.fonts);
  drawHeaderBand(page, doc.fonts, doc.kind, doc.subtitle);
  doc.page = page;
  doc.y = BODY_TOP;
}

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y - needed < BODY_BOTTOM) newPage(doc);
}

function heading(doc: Doc, text: string) {
  ensureSpace(doc, 40);
  doc.y -= 12;
  doc.page.drawText(text.toUpperCase(), {
    x: MARGIN,
    y: doc.y,
    size: 10,
    font: doc.fonts.bold,
    color: NAVY,
  });
  doc.y -= 7;
  doc.page.drawLine({
    start: { x: MARGIN, y: doc.y },
    end: { x: MARGIN + CONTENT_W, y: doc.y },
    thickness: 1,
    color: HONEY,
  });
  doc.y -= 14;
}

function body(doc: Doc, text: string, opts?: { size?: number; color?: typeof INK; font?: PDFFont }) {
  const size = opts?.size ?? 9.5;
  const lineHeight = size + 4.5;
  for (const line of wrap(text, opts?.font ?? doc.fonts.regular, size, CONTENT_W)) {
    ensureSpace(doc, lineHeight);
    doc.page.drawText(line, {
      x: MARGIN,
      y: doc.y,
      size,
      font: opts?.font ?? doc.fonts.regular,
      color: opts?.color ?? INK,
    });
    doc.y -= lineHeight;
  }
}

function footerNote(doc: Doc, text: string) {
  for (const page of doc.pdf.getPages()) {
    page.drawText(text, { x: MARGIN, y: 52, size: 7.5, font: doc.fonts.italic, color: MUTED });
  }
}

/** Signature panel matching the sample agreements. */
async function signatureBlock(
  doc: Doc,
  input: { signerName: string | null; signatureDataUrl: string | null; signedAt: string | null },
) {
  const height = 128;
  ensureSpace(doc, height + 24);
  doc.y -= 12;
  const top = doc.y;
  const boxY = top - height;

  doc.page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_W,
    height,
    color: PANEL,
    borderColor: HAIRLINE,
    borderWidth: 1,
  });
  doc.page.drawText("S I G N E D", {
    x: MARGIN + 16,
    y: top - 22,
    size: 8.5,
    font: doc.fonts.bold,
    color: MUTED,
  });

  if (input.signatureDataUrl?.startsWith("data:image/png;base64,")) {
    try {
      const png = await doc.pdf.embedPng(input.signatureDataUrl);
      const maxW = 190;
      const maxH = 52;
      const scale = Math.min(maxW / png.width, maxH / png.height);
      doc.page.drawImage(png, {
        x: MARGIN + 16,
        y: boxY + 52,
        width: png.width * scale,
        height: png.height * scale,
      });
    } catch {
      // A malformed signature must never break document generation.
    }
  }

  doc.page.drawLine({
    start: { x: MARGIN + 16, y: boxY + 46 },
    end: { x: MARGIN + 232, y: boxY + 46 },
    thickness: 1,
    color: HAIRLINE,
  });
  doc.page.drawText(input.signerName || "Awaiting signature", {
    x: MARGIN + 16,
    y: boxY + 32,
    size: 10,
    font: doc.fonts.bold,
    color: NAVY,
  });
  doc.page.drawText("Merchant", { x: MARGIN + 16, y: boxY + 20, size: 8, font: doc.fonts.regular, color: MUTED });

  const metaX = MARGIN + 268;
  let metaY = top - 46;
  const meta = (label: string, value: string) => {
    doc.page.drawText(label.toUpperCase(), { x: metaX, y: metaY, size: 7.5, font: doc.fonts.regular, color: MUTED });
    doc.page.drawText(value, { x: metaX, y: metaY - 12, size: 9.5, font: doc.fonts.bold, color: NAVY });
    metaY -= 30;
  };
  meta("Signed", input.signedAt ? dateTime(input.signedAt) : "Not yet signed");
  meta("Document generated", dateTime(new Date().toISOString()));

  doc.y = boxY - 10;
}

type DealRow = {
  id: string;
  type: string;
  hardware_amount: number | null;
  subscription_monthly: number | null;
  subscription_months: number | null;
  total_amount: number | null;
  is_demo: boolean | null;
  payment_method: string | null;
  contract_signer_name: string | null;
  contract_signature: string | null;
  contract_signed_at: string | null;
  created_at: string;
  paid_at: string | null;
  nectarpay_invoice_id: string | null;
};

type Ctx = {
  deal: DealRow;
  businessName: string;
  address: string;
  repName: string;
  serial: string;
  trialStart: string;
  trialEnd: string;
  trialDays: number;
};

function partyLine(doc: Doc, ctx: Ctx, closing: string) {
  body(
    doc,
    `Between NectarPay ("NectarPay") and ${ctx.businessName}${ctx.address ? `, ${ctx.address}` : ""} ("the Merchant")${closing}`,
  );
  doc.y -= 2;
  body(doc, `${ctx.deal.type === "contingent" ? "Delivered" : "Sold"} by ${ctx.repName}.`);
}

function titleBlock(doc: Doc, ctx: Ctx, title: string, rightNote?: string) {
  doc.page.drawText(title, { x: MARGIN, y: doc.y, size: 21, font: doc.fonts.bold, color: NAVY });
  if (rightNote) {
    doc.page.drawText(rightNote, {
      x: PAGE_W - MARGIN - doc.fonts.regular.widthOfTextAtSize(rightNote, 9.5),
      y: doc.y + 4,
      size: 9.5,
      font: doc.fonts.regular,
      color: MUTED,
    });
  }
  doc.y -= 20;
  body(doc, `${ctx.businessName}${ctx.address ? ` · ${ctx.address}` : ""}`, { color: MUTED });
  doc.y -= 8;
}

async function renderTrialAgreement(doc: Doc, ctx: Ctx) {
  titleBlock(doc, ctx, "Trial Terminal Agreement");
  partyLine(doc, ctx, ".");

  const sections = trialAgreementSections({
    serial: ctx.serial,
    trialStart: ctx.trialStart,
    trialEnd: ctx.trialEnd,
    trialDays: ctx.trialDays,
    hardwareAmount: Number(ctx.deal.hardware_amount ?? 499),
    subscriptionMonthly: Number(ctx.deal.subscription_monthly ?? 19),
  });
  for (const [title, text] of sections) {
    heading(doc, title);
    body(doc, text);
  }


  await signatureBlock(doc, {
    signerName: ctx.deal.contract_signer_name,
    signatureDataUrl: ctx.deal.contract_signature,
    signedAt: ctx.deal.contract_signed_at,
  });
  footerNote(doc, "NectarPay trial terminal agreement. Generated by the NectarPay sales CRM.");
}

async function renderPurchaseAgreement(doc: Doc, ctx: Ctx) {
  const monthly = Number(ctx.deal.subscription_monthly ?? 0);
  const months = Number(ctx.deal.subscription_months ?? 0);
  const hardware = Number(ctx.deal.hardware_amount ?? 0);

  titleBlock(doc, ctx, "Purchase Agreement");
  partyLine(doc, ctx, `, dated ${isoDate(ctx.deal.created_at)}.`);

  const sections = purchaseAgreementSections({
    serial: ctx.serial,
    hardwareAmount: hardware,
    subscriptionMonthly: monthly,
    subscriptionMonths: months,
    totalAmount: Number(ctx.deal.total_amount ?? hardware),
    paymentMethod: ctx.deal.payment_method,
  });

  for (const [title, text] of sections) {
    heading(doc, title);
    body(doc, text);
  }

  await signatureBlock(doc, {
    signerName: ctx.deal.contract_signer_name,
    signatureDataUrl: ctx.deal.contract_signature,
    signedAt: ctx.deal.contract_signed_at,
  });
  footerNote(doc, "NectarPay purchase agreement. Generated by the NectarPay sales CRM.");
}

function renderInvoice(doc: Doc, ctx: Ctx) {
  const monthly = Number(ctx.deal.subscription_monthly ?? 0);
  const months = Number(ctx.deal.subscription_months ?? 0);
  const hardware = Number(ctx.deal.hardware_amount ?? 0);
  const subscriptionTotal = monthly * months;
  const total = Number(ctx.deal.total_amount ?? hardware + subscriptionTotal);
  const invoiceNo = `INV-${ctx.deal.id.slice(0, 8).toUpperCase()}`;
  const issued = ctx.deal.paid_at ?? ctx.deal.created_at;

  titleBlock(doc, ctx, "Invoice", `${invoiceNo} · ${ctx.deal.paid_at ? "Paid" : "Due on receipt"}`);
  body(doc, `Issued ${longDate(issued)} by ${ctx.repName}`, { color: MUTED });
  doc.y -= 6;

  heading(doc, "What is being billed");
  const colQty = MARGIN + 300;
  const colRate = MARGIN + 350;
  const colAmountRight = MARGIN + CONTENT_W;
  const rightText = (text: string, y: number, font: PDFFont, size: number, color = INK) =>
    doc.page.drawText(text, { x: colAmountRight - font.widthOfTextAtSize(text, size), y, size, font, color });

  doc.page.drawText("ITEM", { x: MARGIN, y: doc.y, size: 7.5, font: doc.fonts.bold, color: MUTED });
  doc.page.drawText("QTY", { x: colQty, y: doc.y, size: 7.5, font: doc.fonts.bold, color: MUTED });
  doc.page.drawText("RATE", { x: colRate, y: doc.y, size: 7.5, font: doc.fonts.bold, color: MUTED });
  rightText("AMOUNT", doc.y, doc.fonts.bold, 7.5, MUTED);
  doc.y -= 8;
  doc.page.drawLine({
    start: { x: MARGIN, y: doc.y },
    end: { x: colAmountRight, y: doc.y },
    thickness: 0.8,
    color: HAIRLINE,
  });
  doc.y -= 18;

  const lineItem = (name: string, sub: string[], qty: string, rate: string, amount: string) => {
    ensureSpace(doc, 22 + sub.length * 10);
    doc.page.drawText(name, { x: MARGIN, y: doc.y, size: 10, font: doc.fonts.bold, color: NAVY });
    doc.page.drawText(qty, { x: colQty, y: doc.y, size: 9.5, font: doc.fonts.regular, color: INK });
    doc.page.drawText(rate, { x: colRate, y: doc.y, size: 9.5, font: doc.fonts.regular, color: INK });
    rightText(amount, doc.y, doc.fonts.regular, 9.5);
    doc.y -= 12;
    for (const s of sub) {
      doc.page.drawText(s, { x: MARGIN, y: doc.y, size: 7.5, font: doc.fonts.regular, color: MUTED });
      doc.y -= 10;
    }
    doc.y -= 8;
  };

  lineItem("NectarPay Terminal", [`serial ${ctx.serial}`, "one time"], "1", money(hardware), money(hardware));
  if (monthly > 0) {
    lineItem(
      "Membership (billed annually)",
      [`billed ${months} months up front`],
      "1",
      `${money(monthly)}/mo`,
      `${money(monthly)}/mo`,
    );
  }

  doc.y -= 4;
  doc.page.drawLine({
    start: { x: colQty - 24, y: doc.y },
    end: { x: colAmountRight, y: doc.y },
    thickness: 0.8,
    color: HAIRLINE,
  });
  doc.y -= 18;

  const totalRow = (label: string, value: string, strong = false) => {
    ensureSpace(doc, 20);
    doc.page.drawText(label, {
      x: colQty - 24,
      y: doc.y,
      size: strong ? 12 : 9.5,
      font: strong ? doc.fonts.bold : doc.fonts.regular,
      color: strong ? NAVY : INK,
    });
    rightText(value, doc.y, strong ? doc.fonts.bold : doc.fonts.regular, strong ? 15 : 9.5, NAVY);
    doc.y -= strong ? 26 : 18;
  };
  totalRow("Hardware, one time", money(hardware));
  if (monthly > 0) totalRow(`Membership, ${months} months`, money(subscriptionTotal));
  doc.y -= 4;
  totalRow(ctx.deal.paid_at ? "Paid in full" : "Due today", money(total), true);

  if (ctx.deal.payment_method || ctx.deal.nectarpay_invoice_id) {
    heading(doc, "Payment");
    if (ctx.deal.payment_method) body(doc, `Payment method: ${ctx.deal.payment_method}.`);
    if (ctx.deal.nectarpay_invoice_id) body(doc, `Gateway reference: ${ctx.deal.nectarpay_invoice_id}.`);
    if (ctx.deal.paid_at) body(doc, `Payment confirmed ${dateTime(ctx.deal.paid_at)}.`);
  }

  heading(doc, "What is not on this invoice");
  body(
    doc,
    "No percentage of any sale, now or later. No per-transaction fee. No settlement fee. Payments settle directly to a wallet the merchant owns and controls, and NectarPay never holds or has access to those funds.",
  );

  if (monthly > 0) {
    heading(doc, "After the first year");
    body(
      doc,
      `Membership renews at ${money(subscriptionTotal)} for the following twelve months. The terminal is the merchant's to keep. The membership can be stopped before it renews.`,
    );
  }

  footerNote(doc, "NectarPay invoice. Generated by the NectarPay sales CRM.");
}

/** Builds the PDF bytes for one deal document. */
export async function renderDealDocument(kind: DealDocumentKind, ctx: Ctx): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const doc: Doc = {
    pdf,
    fonts,
    kind,
    subtitle: kind === "invoice" ? "INVOICE" : "AGREEMENT",
    page: undefined as unknown as PDFPage,
    y: 0,
  };
  newPage(doc);

  if (kind === "trial_agreement") await renderTrialAgreement(doc, ctx);
  else if (kind === "purchase_agreement") await renderPurchaseAgreement(doc, ctx);
  else renderInvoice(doc, ctx);

  pdf.setTitle(`${DOC_TITLE[kind]} — ${ctx.businessName}`);
  pdf.setProducer("NectarPay Sales CRM");
  return pdf.save();
}

/**
 * Renders the document for a deal and files it against the prospect.
 * Idempotent per deal + kind: an existing document is returned untouched.
 */
export async function generateDealDocument(
  supabase: Db,
  input: { dealId: string; kind: DealDocumentKind; createdBy: string },
): Promise<{ id: string; created: boolean } | null> {
  const { data: existing } = await supabase
    .from("lead_documents")
    .select("id")
    .eq("deal_id", input.dealId)
    .eq("document_type", input.kind)
    .maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const { data: deal, error } = await supabase
    .from("deals")
    .select(
      "id, lead_id, rep_id, type, hardware_amount, subscription_monthly, subscription_months, total_amount, is_demo, payment_method, device_id, contract_signer_name, contract_signature, contract_signed_at, created_at, paid_at, nectarpay_invoice_id",
    )
    .eq("id", input.dealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deal) throw new Error("Deal not found");

  const [{ data: lead }, { data: rep }, { data: device }, { data: placement }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, business_name, address_line1, city, state, postal_code")
      .eq("id", deal.lead_id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("user_id", deal.rep_id).maybeSingle(),
    deal.device_id
      ? supabase.from("devices").select("serial_number").eq("id", deal.device_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("contingent_placements")
      .select("placed_at, expires_at")
      .eq("deal_id", deal.id)
      .maybeSingle(),
  ]);

  const placedAt = (placement as { placed_at?: string } | null)?.placed_at ?? deal.created_at;
  const expiresAt =
    (placement as { expires_at?: string } | null)?.expires_at ??
    new Date(new Date(deal.created_at).getTime() + 14 * 86_400_000).toISOString();

  const ctx: Ctx = {
    deal: deal as DealRow,
    businessName: lead?.business_name || "the Merchant",
    address: [lead?.address_line1, lead?.city, lead?.state, lead?.postal_code].filter(Boolean).join(", "),
    repName: rep?.full_name || rep?.email || "the NectarPay representative",
    serial: (device as { serial_number?: string } | null)?.serial_number ?? "unassigned",
    trialStart: isoDate(placedAt),
    trialEnd: isoDate(expiresAt),
    trialDays: Math.max(1, Math.round((new Date(expiresAt).getTime() - new Date(placedAt).getTime()) / 86_400_000)),
  };

  const bytes = await renderDealDocument(input.kind, ctx);
  const fileName = `${input.kind.replace(/_/g, "-")}-${deal.id.slice(0, 8)}.pdf`;
  const storagePath = `${deal.lead_id}/${deal.id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("lead-documents")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error: insertError } = await supabase
    .from("lead_documents")
    .insert({
      lead_id: deal.lead_id,
      deal_id: deal.id,
      document_type: input.kind,
      title: `${DOC_TITLE[input.kind]} — ${ctx.businessName}`,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "application/pdf",
      file_size: bytes.byteLength,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  return { id: row.id, created: true };
}
