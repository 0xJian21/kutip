/**
 * Writes the sample invoice PDFs in fixtures/invoices/. Fictional companies only.
 * Run: pnpm --filter @kutip/agent exec tsx fixtures/make-invoices.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Line = [x: number, y: number, size: number, text: string, bold?: boolean];

function pdf(lines: Line[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = lines.map(([x, y, size, text, bold]) => `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

type Invoice = {
  seller: string[];
  billTo: string[];
  meta: Array<[string, string]>;
  items: Array<[desc: string, qty: string, unit: string, amount: string]>;
  totals: Array<[string, string]>;
  notes: string[];
};

function layout(inv: Invoice): Line[] {
  const lines: Line[] = [];
  let y = 790;
  inv.seller.forEach((s, i) => lines.push([50, y - i * 14, i ? 9 : 14, s, i === 0]));
  lines.push([420, 790, 20, "INVOICE", true]);
  y = 700;
  lines.push([50, y, 9, "BILL TO", true]);
  inv.billTo.forEach((s, i) => lines.push([50, y - 14 - i * 13, 10, s]));
  inv.meta.forEach(([k, v], i) => {
    lines.push([360, y - i * 14, 9, k, true]);
    lines.push([460, y - i * 14, 10, v]);
  });
  y = 590;
  lines.push([50, y, 9, "DESCRIPTION", true], [330, y, 9, "QTY", true], [390, y, 9, "UNIT PRICE", true], [480, y, 9, "AMOUNT", true]);
  inv.items.forEach(([d, q, u, a], i) => {
    const row = y - 22 - i * 18;
    lines.push([50, row, 10, d], [330, row, 10, q], [390, row, 10, u], [480, row, 10, a]);
  });
  y = y - 40 - inv.items.length * 18;
  inv.totals.forEach(([k, v], i) => {
    const last = i === inv.totals.length - 1;
    lines.push([360, y - i * 16, last ? 11 : 10, k, last], [480, y - i * 16, last ? 11 : 10, v, last]);
  });
  y = y - 30 - inv.totals.length * 16;
  inv.notes.forEach((n, i) => lines.push([50, y - i * 13, 9, n]));
  return lines;
}

const TERATAI = ["Teratai Woodworks Sdn. Bhd.", "Lot 12, Jalan Perindustrian 3, Bakri", "84200 Muar, Johor, Malaysia", "Reg. 202001034567 (1391234-K)"];

const INVOICES: Record<string, Invoice> = {
  "harbourline-inv-0151.pdf": {
    seller: TERATAI,
    billTo: ["Harbourline Interiors Pty Ltd", "Attn: Claire Whitmore", "41 Harris Street, Pyrmont NSW 2009", "Australia"],
    meta: [["Invoice No.", "INV-2026-0151"], ["Invoice Date", "27 Sep 2026"], ["Due Date", "27 Oct 2026"], ["Currency", "USD"]],
    items: [
      ["Teak dining table, 8-seater", "12", "1,040.00", "12,480.00"],
      ["Teak dining chair, woven seat", "24", "185.50", "4,452.00"],
    ],
    totals: [["Subtotal", "16,932.00"], ["Freight (FOB Port Klang)", "0.00"], ["TOTAL DUE (USD)", "16,932.00"]],
    notes: ["Payment terms: 30 days from invoice date.", "Pay online with the link in the email that accompanied this invoice."],
  },
  "kobayashi-inv-0152.pdf": {
    seller: TERATAI,
    billTo: ["Kobayashi Living Co., Ltd.", "Attn: Yuki Kobayashi (Accounts)", "2-4-8 Minamisemba, Chuo-ku, Osaka", "Japan"],
    meta: [["Invoice No.", "INV-2026-0152"], ["Invoice Date", "20 Sep 2026"], ["Terms", "Net 30"], ["Currency", "USD"]],
    items: [["Rattan armchair, natural finish", "60", "146.00", "8,760.00"]],
    totals: [["Subtotal", "8,760.00"], ["TOTAL (USD)", "8,760.00"]],
    notes: ["Terms: Net 30. Please quote the invoice number with your payment."],
  },
  // The PDF dropped on stage in the SPEC §7 demo (USD 50; number unused by the seed).
  "demo-harbourline-inv-0160.pdf": {
    seller: TERATAI,
    billTo: ["Harbourline Interiors Pty Ltd", "Attn: Claire Whitmore", "41 Harris Street, Pyrmont NSW 2009", "Australia"],
    meta: [["Invoice No.", "INV-2026-0160"], ["Invoice Date", "3 Oct 2026"], ["Due Date", "17 Oct 2026"], ["Currency", "USD"]],
    items: [["Teak serving tray, oiled (sample)", "2", "25.00", "50.00"]],
    totals: [["Subtotal", "50.00"], ["TOTAL DUE (USD)", "50.00"]],
    notes: ["Payment terms: 14 days.", "Pay online with the link in the email that accompanied this invoice."],
  },
  // Same scene at a payable amount (mainnet demo payments stay ≤ 1 USDC).
  "demo-harbourline-inv-0161-usd1.pdf": {
    seller: TERATAI,
    billTo: ["Harbourline Interiors Pty Ltd", "Attn: Claire Whitmore", "41 Harris Street, Pyrmont NSW 2009", "Australia"],
    meta: [["Invoice No.", "INV-2026-0161"], ["Invoice Date", "3 Oct 2026"], ["Due Date", "17 Oct 2026"], ["Currency", "USD"]],
    items: [["Teak coaster, oiled (sample)", "2", "0.50", "1.00"]],
    totals: [["Subtotal", "1.00"], ["TOTAL DUE (USD)", "1.00"]],
    notes: ["Payment terms: 14 days.", "Pay online with the link in the email that accompanied this invoice."],
  },
  "sericraft-inv-a0007.pdf": {
    seller: ["Seri Rotan Craft Enterprise", "No. 7, Jalan Kenanga 2, Batu Pahat", "83000 Johor, Malaysia"],
    billTo: ["Al Rashid Furnishing LLC", "Finance Department", "Al Quoz Industrial Area 3, Dubai", "United Arab Emirates"],
    meta: [["Invoice #", "SRC/A0007"], ["Date", "28 Sep 2026"], ["Payment due", "3 Oct 2026"]],
    items: [
      ["Oak side table (sample)", "2", "$20.00", "$40.00"],
      ["Courier to Dubai", "1", "$10.00", "$10.00"],
    ],
    totals: [["Amount due", "US$ 50.00"]],
    notes: ["Sample order. All amounts in US dollars."],
  },
};

const dir = join(dirname(fileURLToPath(import.meta.url)), "invoices");
mkdirSync(dir, { recursive: true });
for (const [name, inv] of Object.entries(INVOICES)) {
  writeFileSync(join(dir, name), pdf(layout(inv)));
  console.log(`wrote fixtures/invoices/${name}`);
}
