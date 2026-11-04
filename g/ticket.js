// Lectura de tickets en la web: Tesseract.js (OCR en el propio navegador, sin mandar la foto a ningún
// servidor) y el mismo intérprete que la app (TicketParser.kt), traducido línea por línea.
// Si cambias algo del intérprete, cámbialo también en la app y pasa tests/ticket.test.mjs.

// --- Intérprete (TicketParser.kt) ---

const letters = (s) => (s.match(/\p{L}/gu) || []).length;
const stripAccents = (s) => s.normalize("NFD").replace(/\p{Mn}+/gu, "");
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsWord = (upper, w) => new RegExp("(?<![A-Z])" + reEsc(w) + "(?![A-Z])").test(upper);

/** Ángulo de una línea a partir de sus esquinas superiores. */
export function angleOf(x0, y0, x1, y1) { return Math.atan2(y1 - y0, x1 - x0); }

/** Une en filas los trozos de texto del OCR: { text, centerX, centerY, width, height, angle }. */
export function groupRows(lines) {
  const usable = lines.filter((l) => l.text.trim() && l.height > 0);
  if (!usable.length) return [];
  const long = usable.filter((l) => l.width > 3 * l.height).map((l) => l.angle || 0);
  const skew = median(long.length ? long : usable.map((l) => l.angle || 0));
  const c = Math.cos(skew), s = Math.sin(skew);
  const overlap1 = (a, b) => (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) / Math.min(a.bottom - a.top, b.bottom - b.top);
  const placed = usable.map((l) => {
    const y = l.centerY * c - l.centerX * s;
    return { text: l.text, x: l.centerX * c + l.centerY * s, top: y - l.height / 2, bottom: y + l.height / 2 };
  }).sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));

  const rows = [];
  for (const p of placed) {
    const row = rows[rows.length - 1];
    if (row && overlap1(row[0], p) >= 0.5) row.push(p); else rows.push([p]);
  }
  const top = (r) => Math.min(...r.map((p) => p.top)), bottom = (r) => Math.max(...r.map((p) => p.bottom));
  const overlap = (a, b) => (Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b))) / Math.min(bottom(a) - top(a), bottom(b) - top(b));
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    let best = null;
    for (const j of [i - 1, i + 1]) if (j >= 0 && j < rows.length && (best == null || overlap(rows[j], row) > overlap(rows[best], row))) best = j;
    if (row.reduce((n, p) => n + letters(p.text), 0) < 2 && best != null && overlap(rows[best], row) >= 0.25) {
      rows[best].push(...row);
      rows.splice(i, 1);
    } else i++;
  }
  return rows.map((r) => r.slice().sort((a, b) => a.x - b.x).map((p) => p.text.trim()).join(" "));
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function sameLine(a, b) {
  if (a.totalCents !== b.totalCents || a.quantity !== b.quantity) return false;
  const k = (s) => stripAccents(s.toUpperCase()).replace(/[^\p{L}\p{Nd}]/gu, "");
  const x = k(a.name), y = k(b.name);
  return editDistance(x, y) <= Math.floor(Math.max(x.length, y.length) / 4);
}
/** Une los artículos de varias fotos de un ticket, de arriba abajo, sin repetir lo que se solapa. */
export function mergeParts(parts) {
  const merged = [];
  for (const part of parts) {
    let ov = 0;
    for (let k = Math.min(merged.length, part.length); k >= 1; k--) {
      let all = true;
      for (let i = 0; i < k; i++) if (!sameLine(merged[merged.length - k + i], part[i])) { all = false; break; }
      if (all) { ov = k; break; }
    }
    merged.push(...part.slice(ov));
  }
  return merged.map((it, i) => ({ ...it, id: i }));
}

const PRICE = /(?<![\d.,])-?\d{1,5}[.,]\d{2}(?![\d.,%])/gu;
const LEADING_QTY = /^\s*(\d{1,2})\s*[xX×*]?\s+(?=\D)/u;
const COLUMN_QTY = /(?<![\p{L}\d])[xX×]\s?(\d{1,3})(?!\d)/u;
const STOP = ["TOTAL", "BASE", "SUBTOTAL", "IMPONIBLE", "AMOUNT DUE", "BALANCE DUE"];
const SKIP = [
  "TOTAL", "BASE", "IVA", "I.V.A", "CUOTA", "IMPUESTO", "ENTREGADO", "CAMBIO", "EFECTIVO",
  "TARJETA", "VISA", "MASTERCARD", "PAGADO", "PAGO", "A PAGAR", "PROPINA", "NIF", "CIF", "TEL",
  "TAX", "VAT", "GST", "CHANGE", "CASH", "CARD", "AMEX", "PAID", "TIP", "GRATUITY", "AMOUNT DUE",
  "BALANCE DUE", "SERVICE CHARGE", "PHONE",
  "IMPOST", "QUOTA", "LLIURAT", "CANVI", "TARGETA", "PAGAT", "PAGAMENT",
];
const HEADER = [
  "DESCRIPCION", "PRECIO", "IMPORTE", "CANT", "FACTURA", "FECHA", "CAJA",
  "DESCRIPTION", "PRICE", "AMOUNT", "QTY", "QUANTITY", "INVOICE", "RECEIPT", "DATE", "SERVER", "TABLE",
  "DESCRIPCIO", "PREU", "IMPORT", "QUANT", "CAIXA",
];
const COLUMNS = [
  "ARTICULO", "DESCRIPCION", "CONCEPTO", "PRODUCTO", "PRECIO", "IMPORTE", "CANT", "UND", "UDS", "P.V.P",
  "ITEM", "DESCRIPTION", "PRICE", "AMOUNT", "QTY",
  "ARTICLE", "DESCRIPCIO", "PREU", "IMPORT", "QUANT",
];

function toCents(s) {
  const neg = s.startsWith("-"), [a, b] = s.replace("-", "").split(/[.,]/);
  const v = Number(a) * 100 + Number(b);
  return neg ? -v : v;
}
function trimChars(s, chars) {
  let i = 0, j = s.length;
  while (i < j && chars.includes(s[i])) i++;
  while (j > i && chars.includes(s[j - 1])) j--;
  return s.slice(i, j);
}
function cleanName(t) {
  t = t.replace(/\b\d{6,}\b/g, " ")
    .replace(/(?<=\p{L})0(?=\p{L})/gu, "o")
    .replace(/(?<=\p{Ll})\p{Lu}(?!\p{L})/gu, (m) => m.toLowerCase())
    .replace(/\s+[A-D]\s*$/u, "")
    .replace(/\s+/gu, " ");
  // Además de lo de la app, rayas y barras que Tesseract suele leer en los bordes.
  return trimChars(t.trim(), ".-*:xX€ —–_|");
}
function normalize(t) {
  return t.replace(/(?<=\d[.,]?)[Oo]|[Oo](?=[.,]?\d)/g, "0").replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, "$1$2$3");
}

/** Interpreta las filas: artículos { id, name, quantity, totalCents } y el total impreso, si lo hay. */
export function parseRows(rows) {
  let items = [], printed = null, ended = false, pendingName = null, skipNext = false;
  for (let index = 0; index < rows.length; index++) {
    if (skipNext) { skipNext = false; continue; }
    const row = normalize(rows[index]);
    const upper = stripAccents(row.toUpperCase());
    const prices = [...row.matchAll(PRICE)];

    if (!ended && !prices.length && COLUMNS.filter((w) => containsWord(upper, w)).length >= 2) { items = []; pendingName = null; continue; }
    if (upper.includes("TOTAL") && !upper.includes("SUBTOTAL") && prices.length) printed = Math.max(printed || 0, toCents(prices[prices.length - 1][0]));
    if (items.length && STOP.some((w) => upper.includes(w))) ended = true;
    if (ended || SKIP.some((w) => containsWord(upper, w))) { pendingName = null; continue; }
    if (!prices.length) {
      const name = cleanName(row);
      pendingName = letters(name) >= 2 && !HEADER.some((w) => upper.includes(w)) ? name : null;
      continue;
    }

    const first = prices[0].index, last = prices[prices.length - 1];
    const total = toCents(last[0]);
    const unit = prices.length >= 2 ? toCents(prices[prices.length - 2][0]) : null;
    let description = row.slice(0, first);

    if (total < 0) {
      if (items.length) { const l = items.pop(); items.push({ ...l, totalCents: Math.max(0, l.totalCents + total) }); }
      pendingName = null; continue;
    }
    if (total === 0) { pendingName = null; continue; }

    let quantity = null;
    const lq = description.match(LEADING_QTY);
    if (lq) { quantity = Number(lq[1]); description = description.slice(lq.index + lq[0].length); }
    if (quantity == null) {
      const between = row.slice(first, last.index);
      const m = between.match(COLUMN_QTY) || description.match(COLUMN_QTY);
      if (m) { const q = Number(m[1]); quantity = q >= 1 && q <= 999 ? q : null; description = description.split(m[0]).join(" "); }
    }
    if (quantity == null && unit != null && unit > 0 && total % unit === 0 && total / unit >= 2 && total / unit <= 99) quantity = total / unit;

    let name = cleanName(description);
    if (letters(name) < 2) {
      const next = index + 1 < rows.length ? normalize(rows[index + 1]) : null;
      if (pendingName != null) name = pendingName;
      else if (next != null && !new RegExp(PRICE.source, "u").test(next)) { name = cleanName(next); skipNext = true; }
    }
    pendingName = null;
    if (letters(name) < 2) { skipNext = false; continue; }
    items.push({ id: items.length, name, quantity: Math.max(1, quantity || 1), totalCents: total });
  }
  return { items, printedTotalCents: printed };
}

export function parse(lines) { return parseRows(groupRows(lines)); }

// --- OCR con Tesseract.js (se descarga la primera vez que se usa: unos 6 MB, luego queda guardado) ---

let workerP = null;
function loadScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("load " + src)); document.head.appendChild(s); });
}
async function worker(onProgress) {
  if (!workerP) workerP = (async () => {
    const base = new URL("ocr/", import.meta.url).href;
    if (!window.Tesseract) await loadScript(base + "tesseract.min.js");
    const w = await window.Tesseract.createWorker("spa", 1, {
      workerPath: base + "worker.min.js", corePath: base, langPath: base.replace(/\/$/, ""), workerBlobURL: false,
      logger: (m) => { if (workerP.onProgress) workerP.onProgress(m); },
    });
    // Modo 4: una columna de texto de tamaños variables, lo más parecido a un ticket.
    await w.setParameters({ tessedit_pageseg_mode: "4", preserve_interword_spaces: "1" });
    return w;
  })();
  workerP.onProgress = onProgress;
  try { return await workerP; } catch (e) { workerP = null; throw e; }
}

/** La foto en gris, girada [turns] cuartos de vuelta y con el lado largo de 2400 px como mucho. */
async function prepare(file, turns) {
  const bmp = await createImageBitmap(file); // aplica la orientación EXIF de la cámara
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k), side = turns % 2 !== 0;
  const cv = document.createElement("canvas");
  cv.width = side ? h : w; cv.height = side ? w : h;
  const x = cv.getContext("2d");
  x.filter = "grayscale(1) contrast(1.3)";
  x.translate(cv.width / 2, cv.height / 2); x.rotate(turns * Math.PI / 2); x.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close && bmp.close();
  return cv;
}

function toLines(data) {
  const out = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const bb = l.bbox, bl = l.baseline || {};
    const angle = bl.has_baseline !== false && bl.x1 > bl.x0 ? angleOf(bl.x0, bl.y0, bl.x1, bl.y1) : 0;
    const w = bb.x1 - bb.x0, h = (l.rowAttributes && l.rowAttributes.row_height) || Math.max(1, (bb.y1 - bb.y0) - Math.abs(Math.sin(angle)) * w);
    out.push({ text: l.text.replace(/\n/g, " "), centerX: (bb.x0 + bb.x1) / 2, centerY: (bb.y0 + bb.y1) / 2, width: w, height: h, angle });
  }
  return out;
}

/**
 * Lee las fotos (trozos del mismo ticket, de arriba abajo). [onProgress](foto, fotos, fracción, fase)
 * con fase "load" mientras descarga el lector la primera vez y "read" mientras lee.
 */
export async function scan(files, onProgress) {
  let cur = 0;
  const w = await worker((m) => {
    if (!onProgress) return;
    if (m.status === "recognizing text") onProgress(cur, files.length, m.progress || 0, "read");
    else onProgress(cur, files.length, m.progress || 0, "load");
  });
  const parts = [];
  for (cur = 0; cur < files.length; cur++) {
    let best = null;
    // Si la foto está de lado no sale ningún artículo: se prueba girándola.
    for (const turns of [0, 1, 3]) {
      const r = await w.recognize(await prepare(files[cur], turns), {}, { blocks: true, text: false });
      const t = parse(toLines(r.data));
      if (!best || t.items.length > best.items.length) best = t;
      if (best.items.length) break;
    }
    parts.push(best);
  }
  const totals = parts.map((p) => p.printedTotalCents).filter((x) => x != null);
  return { items: mergeParts(parts.map((p) => p.items)), printedTotalCents: totals.length ? totals[totals.length - 1] : null };
}
