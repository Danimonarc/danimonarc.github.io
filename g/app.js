// Distro en la web: tus grupos, saldos, gastos a partes iguales y pagos, con cuenta de Google o enlace por correo.
// Los datos van por la API REST de Firestore (como /t/): los ids de 64 bits no caben en un número de JS
// y aquí se tratan siempre como texto. Quién puede leer y escribir qué lo deciden las reglas de Firestore.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, signOut, deleteUser,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Clave pública de la web (restringida a montarc.es): no es un secreto.
const KEY = "AIzaSyBGyMSB2-HcDlcOwm9XJ-Qt5k5lcybBgoU", PROJECT = "distro-58a19";
const DOCS = "projects/" + PROJECT + "/databases/(default)/documents";
const ROOT = "https://firestore.googleapis.com/v1/" + DOCS;
const auth = getAuth(initializeApp({ apiKey: KEY, authDomain: PROJECT + ".firebaseapp.com", projectId: PROJECT }));
window.distroReady = true;

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const S = { user: null, code: clean(params.get("c")), groups: null, gid: null, group: null, expenses: [], tickets: 0, tab: "exp", sig: null, busy: false };
function clean(c) { c = (c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return c.length === 6 ? c : null; }
function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

// --- Idioma: español, inglés o catalán según el navegador (o ?lang=) ---
const LANG = ((l) => { l = l.toLowerCase(); return l.startsWith("ca") ? "ca" : l.startsWith("es") ? "es" : "en"; })(params.get("lang") || navigator.language || "en");
const LOC = { es: "es-ES", ca: "ca-ES", en: "en-IE" }[LANG];
const LI = { es: 0, en: 1, ca: 2 }[LANG];
auth.languageCode = LANG;
const TX = {
  login_h1: ["Tus grupos de Distro", "Your Distro groups", "Els teus grups de Distro"],
  login_sub: ["Entra para ver tus grupos", "Sign in to see your groups", "Entra per veure els teus grups"],
  login_join: ["Entra para unirte al grupo", "Sign in to join the group", "Entra per unir-te al grup"],
  login_text: ["Los grupos son privados: solo los ven quienes están en ellos. Si usas la app de Android, entra con la misma cuenta de Google y verás los mismos grupos.", "Groups are private: only their members can see them. If you use the Android app, sign in with the same Google account to see the same groups.", "Els grups són privats: només els veuen qui hi és. Si fas servir l'app d'Android, entra amb el mateix compte de Google i veuràs els mateixos grups."],
  google: ["Entrar con Google", "Sign in with Google", "Entrar amb Google"],
  or_email: ["o con tu correo, sin contraseña", "or with your email, no password", "o amb el teu correu, sense contrasenya"],
  email_ph: ["tu@correo.com", "you@email.com", "tu@correu.cat"],
  send_link: ["Enviarme un enlace para entrar", "Email me a sign-in link", "Envia'm un enllaç per entrar"],
  sending: ["Enviando…", "Sending…", "Enviant…"],
  link_sent: ["Te hemos enviado un enlace a <b>{0}</b>. Ábrelo en este mismo navegador para entrar. Si no llega, mira en la carpeta de spam.", "We've sent a link to <b>{0}</b>. Open it in this same browser to sign in. If it doesn't arrive, check your spam folder.", "T'hem enviat un enllaç a <b>{0}</b>. Obre'l en aquest mateix navegador per entrar. Si no arriba, mira a la carpeta de correu brossa."],
  email_again: ["Para terminar de entrar, escribe el correo al que te llegó el enlace.", "To finish signing in, type the email the link was sent to.", "Per acabar d'entrar, escriu el correu on et va arribar l'enllaç."],
  finish: ["Entrar", "Sign in", "Entrar"],
  e_popup: ["El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes de esta web e inténtalo otra vez.", "The browser blocked the Google window. Allow pop-ups for this site and try again.", "El navegador ha bloquejat la finestra de Google. Permet les finestres emergents d'aquest web i torna-ho a provar."],
  e_setup: ["Esta forma de entrar aún no está activada. Prueba con la otra o avisa a quien te invitó.", "This sign-in method isn't enabled yet. Try the other one or tell whoever invited you.", "Aquesta manera d'entrar encara no està activada. Prova l'altra o avisa qui t'ha convidat."],
  e_quota: ["Hoy ya no se pueden enviar más enlaces por correo. Entra con Google o inténtalo mañana.", "No more email links can be sent today. Sign in with Google or try again tomorrow.", "Avui ja no es poden enviar més enllaços per correu. Entra amb Google o torna-ho a provar demà."],
  e_login: ["No se ha podido entrar. Inténtalo de nuevo.", "Couldn't sign in. Please try again.", "No s'ha pogut entrar. Torna-ho a provar."],
  e_badlink: ["El enlace para entrar no es válido o ya se usó. Pide otro.", "The sign-in link isn't valid or was already used. Ask for another one.", "L'enllaç per entrar no és vàlid o ja s'ha fet servir. Demana'n un altre."],
  e_conn: ["No se ha podido conectar. Revisa tu conexión.", "Couldn't connect. Check your connection.", "No s'ha pogut connectar. Revisa la connexió."],
  retry: ["Reintentar", "Retry", "Tornar-ho a provar"],
  home_h1: ["Tus grupos", "Your groups", "Els teus grups"],
  groups_1: ["1 grupo", "1 group", "1 grup"],
  groups_n: ["{0} grupos", "{0} groups", "{0} grups"],
  people_1: ["1 persona", "1 person", "1 persona"],
  people_n: ["{0} personas", "{0} people", "{0} persones"],
  no_groups: ["Aún no estás en ningún grupo. Pide a alguien del grupo que te invite desde la app (menú del grupo → Invitar) y abre el enlace, o escribe aquí el código.", "You're not in any group yet. Ask someone in the group to invite you from the app (group menu → Invite) and open the link, or type the code here.", "Encara no ets a cap grup. Demana a algú del grup que et convidi des de l'app (menú del grup → Convidar) i obre l'enllaç, o escriu aquí el codi."],
  join_title: ["Unirse con un código", "Join with a code", "Unir-se amb un codi"],
  join_btn: ["Unirse", "Join", "Unir-se"],
  joining: ["Entrando en el grupo…", "Joining the group…", "Entrant al grup…"],
  e_code: ["El código no existe o ha caducado. Pide uno nuevo.", "That code doesn't exist or has expired. Ask for a new one.", "El codi no existeix o ha caducat. Demana'n un de nou."],
  e_join: ["No se ha podido entrar en el grupo.", "Couldn't join the group.", "No s'ha pogut entrar al grup."],
  install_ios: ["Para tenerla como una app: botón Compartir → «Añadir a pantalla de inicio».", "To keep it like an app: Share button → “Add to Home Screen”.", "Per tenir-la com una app: botó Compartir → «Afegir a la pantalla d'inici»."],
  install: ["Instalar en este dispositivo", "Install on this device", "Instal·lar en aquest dispositiu"],
  get_app: ["¿Tienes Android? Descarga Distro en Google Play para escanear tickets.", "On Android? Get Distro on Google Play to scan receipts.", "Tens Android? Descarrega Distro a Google Play per escanejar tiquets."],
  back: ["← Tus grupos", "← Your groups", "← Els teus grups"],
  tab_exp: ["Gastos", "Expenses", "Despeses"],
  tab_bal: ["Saldos", "Balances", "Saldos"],
  spent: ["{0} gastados", "{0} spent", "{0} gastats"],
  no_exp: ["Todavía no hay gastos. Añade el primero con el botón de abajo.", "No expenses yet. Add the first one with the button below.", "Encara no hi ha despeses. Afegeix la primera amb el botó de sota."],
  paid_by: ["Pagó {0}", "Paid by {0}", "Va pagar {0}"],
  your_share: ["tu parte {0}", "your share {0}", "la teva part {0}"],
  refund: ["Reembolso", "Repayment", "Reemborsament"],
  you: ["tú", "you", "tu"],
  bal_hint: ["En verde, lo que le deben; en rojo, lo que debe.", "Green: what they're owed. Red: what they owe.", "En verd, el que li deuen; en vermell, el que deu."],
  settle_title: ["Para quedar en paz", "To settle up", "Per quedar en pau"],
  all_settled: ["Todo saldado. 🎉", "All settled up. 🎉", "Tot saldat. 🎉"],
  pays: ["{0} paga a {1}", "{0} pays {1}", "{0} paga a {1}"],
  i_paid: ["Ya te he pagado", "I've paid you", "Ja t'he pagat"],
  they_paid: ["Me lo ha pagado", "They paid me", "Me l'ha pagat"],
  mark_paid: ["Apuntar como pagado", "Mark as paid", "Apuntar com a pagat"],
  confirm_paid: ["¿Apuntar que {0} ha pagado {1} a {2}?", "Record that {0} paid {1} to {2}?", "Apuntar que {0} ha pagat {1} a {2}?"],
  paid_ok: ["Pago apuntado. Lo verá todo el grupo.", "Payment recorded. The whole group will see it.", "Pagament apuntat. El veurà tot el grup."],
  who_title: ["¿Quién eres en este grupo?", "Who are you in this group?", "Qui ets en aquest grup?"],
  who_hint: ["Elige tu nombre para ver lo que debes y lo que te deben.", "Pick your name to see what you owe and what you're owed.", "Tria el teu nom per veure el que deus i el que et deuen."],
  not_listed: ["¿No estás en la lista?", "Not on the list?", "No ets a la llista?"],
  name_ph: ["Tu nombre", "Your name", "El teu nom"],
  add_me: ["Añadirme al grupo", "Add me to the group", "Afegir-me al grup"],
  taken: ["(ya es otra cuenta)", "(another account)", "(ja és un altre compte)"],
  add_exp: ["+ Añadir gasto", "+ Add expense", "+ Afegir despesa"],
  new_exp: ["Nuevo gasto", "New expense", "Nova despesa"],
  concept: ["Concepto", "Description", "Concepte"],
  concept_ph: ["Cena, gasolina, compra…", "Dinner, fuel, groceries…", "Sopar, benzina, compra…"],
  amount: ["Importe ({0})", "Amount ({0})", "Import ({0})"],
  paid_by_lbl: ["Pagado por", "Paid by", "Pagat per"],
  between: ["Entre quién, a partes iguales", "Split equally between", "Entre qui, a parts iguals"],
  each: ["{0} cada uno", "{0} each", "{0} cadascú"],
  save: ["Guardar", "Save", "Desar"],
  cancel: ["Cancelar", "Cancel", "Cancel·lar"],
  saving: ["Guardando…", "Saving…", "Desant…"],
  e_amount: ["Escribe un importe mayor que cero (por ejemplo, 12,50).", "Type an amount above zero (for example, 12.50).", "Escriu un import més gran que zero (per exemple, 12,50)."],
  e_between: ["Elige al menos a una persona.", "Pick at least one person.", "Tria almenys una persona."],
  e_concept: ["Escribe un concepto.", "Type a description.", "Escriu un concepte."],
  e_save: ["No se ha podido guardar. Inténtalo de nuevo.", "Couldn't save. Please try again.", "No s'ha pogut desar. Torna-ho a provar."],
  saved: ["Gasto guardado.", "Expense saved.", "Despesa desada."],
  pending_1: ["Hay 1 ticket pendiente de repartir. Ábrelo con el enlace que te enviaron o en la app.", "1 receipt is waiting to be split. Open it from the link you were sent or in the app.", "Hi ha 1 tiquet pendent de repartir. Obre'l amb l'enllaç que et van enviar o a l'app."],
  pending_n: ["Hay {0} tickets pendientes de repartir. Ábrelos con el enlace que te enviaron o en la app.", "{0} receipts are waiting to be split. Open them from the link you were sent or in the app.", "Hi ha {0} tiquets pendents de repartir. Obre'ls amb l'enllaç que et van enviar o a l'app."],
  e_gone: ["Este grupo ya no existe o no estás en él.", "This group no longer exists or you're not in it.", "Aquest grup ja no existeix o no hi ets."],
  account: ["Cuenta", "Account", "Compte"],
  signed_as: ["Has entrado como {0}", "Signed in as {0}", "Has entrat com a {0}"],
  sign_out: ["Cerrar sesión", "Sign out", "Tancar la sessió"],
  delete_acct: ["Eliminar mi cuenta", "Delete my account", "Eliminar el meu compte"],
  confirm_delete: ["Se eliminará tu cuenta y saldrás de todos tus grupos (los grupos en los que solo estás tú se borran con sus gastos). Lo que apuntaste en los demás grupos se queda. ¿Seguro?", "Your account will be deleted and you'll leave all your groups (groups where you're the only member are deleted with their expenses). What you added to other groups stays. Are you sure?", "S'eliminarà el teu compte i sortiràs de tots els grups (els grups on només hi ets tu s'esborren amb les despeses). El que vas apuntar als altres grups s'hi queda. Segur?"],
  e_relogin: ["Por seguridad, vuelve a entrar y repite «Eliminar mi cuenta».", "For security, sign in again and repeat “Delete my account”.", "Per seguretat, torna a entrar i repeteix «Eliminar el meu compte»."],
  e_delete: ["No se ha podido eliminar la cuenta. Inténtalo de nuevo.", "Couldn't delete the account. Please try again.", "No s'ha pogut eliminar el compte. Torna-ho a provar."],
  deleted: ["Tu cuenta se ha eliminado.", "Your account has been deleted.", "El teu compte s'ha eliminat."],
};
function tr(k, ...a) { let s = (TX[k] || [k])[LI]; a.forEach((v, i) => { s = s.split("{" + i + "}").join(v); }); return s; }

// --- Utilidades ---
function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function money(c, cur) {
  cur = cur || (S.group && S.group.currency) || "EUR";
  try { return (Number(c) / 100).toLocaleString(LOC, { style: "currency", currency: cur }); }
  catch (e) { return (Number(c) / 100).toLocaleString(LOC, { style: "currency", currency: "EUR" }); }
}
function day(ms) { return ms ? new Date(ms).toLocaleDateString(LOC, { day: "numeric", month: "short" }) : ""; }
function initial(n) { return esc((n || "?").trim().charAt(0).toUpperCase() || "?"); }
function avatar(g) { return g.icon ? '<span class="av emoji" aria-hidden="true">' + esc(g.icon) + "</span>" : '<span class="av" aria-hidden="true">' + initial(g.name) + "</span>"; }
function plural(n, one, many) { return n === 1 ? tr(one) : tr(many, n); }
// Id aleatorio de 63 bits como en la app (newId() en Group.kt), en texto.
function newId() { const a = new Uint32Array(2); crypto.getRandomValues(a); const v = (BigInt(a[0] & 0x7fffffff) << 32n) | BigInt(a[1]); return (v || 1n).toString(); }
function autoId() { const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", a = new Uint8Array(20); crypto.getRandomValues(a); return Array.from(a, (x) => c[x % 62]).join(""); }
function cmpId(a, b) { a = BigInt(a); b = BigInt(b); return a < b ? -1 : a > b ? 1 : 0; }

function status(msg, kind, retry) {
  $("skel").hidden = true;
  const n = $("status");
  n.className = msg ? "note " + (kind || "") : "";
  n.innerHTML = msg || "";
  if (retry) { const b = document.createElement("button"); b.textContent = tr("retry"); b.onclick = () => { status(""); retry(); }; n.appendChild(document.createElement("br")); n.appendChild(b); }
}
let flashTimer;
function flash(msg) { status(esc(msg)); clearTimeout(flashTimer); flashTimer = setTimeout(() => status(""), 4000); }
function header(h1, sub) { $("h1").textContent = h1; $("sub").textContent = sub || " "; document.title = h1 + " · Distro"; }

// --- Firestore por REST (enteros como texto) ---
const str = (s) => ({ stringValue: String(s) }), int = (x) => ({ integerValue: String(x) }), bool = (b) => ({ booleanValue: !!b }), mv = (f) => ({ mapValue: { fields: f } });
const tick = (s) => "`" + s + "`";
const docName = (p) => DOCS + "/" + p;
function dec(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return v.integerValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) { const o = {}, f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  return null;
}
const decDoc = (d) => dec({ mapValue: { fields: d.fields || {} } });
const idOf = (d) => d.name.split("/").pop();

async function call(url, opts) {
  opts = opts || {};
  const token = await auth.currentUser.getIdToken();
  opts.headers = Object.assign({ Authorization: "Bearer " + token, "Content-Type": "application/json" }, opts.headers || {});
  return fetch(url, opts);
}
// null si no existe o las reglas no dejan verlo (un código caducado, un grupo del que ya no eres miembro).
async function getDoc(path) {
  const r = await call(ROOT + "/" + path);
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error(path + " " + r.status);
  return decDoc(await r.json());
}
async function listDocs(path) {
  let out = [], page = "";
  do {
    const r = await call(ROOT + "/" + path + "?pageSize=300" + (page ? "&pageToken=" + encodeURIComponent(page) : ""));
    if (!r.ok) throw new Error(path + " " + r.status);
    const j = await r.json();
    (j.documents || []).forEach((d) => out.push({ id: idOf(d), data: decDoc(d) }));
    page = j.nextPageToken;
  } while (page);
  return out;
}
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await call(ROOT + ":commit", { method: "POST", body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    if (!r.ok) throw new Error("commit " + r.status + " " + (await r.text()).slice(0, 300));
  }
}
async function myGroups() {
  const r = await call(ROOT + ":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: "groups" }],
    where: { fieldFilter: { field: { fieldPath: "memberUids" }, op: "ARRAY_CONTAINS", value: str(S.user.uid) } },
  } }) });
  if (!r.ok) throw new Error("groups " + r.status);
  return (await r.json()).filter((x) => x.document).map((x) => toGroup(idOf(x.document), decDoc(x.document)));
}

function toGroup(id, d) {
  const who = d.who || {};
  return {
    id, name: d.name || "", icon: d.icon || null,
    currency: /^[A-Z]{3}$/.test(d.currency || "") ? d.currency : "EUR",
    people: (d.people || []).filter((p) => p && p.id != null).map((p) => ({ id: String(p.id), name: p.name || "?" })),
    members: (d.memberUids || []).length,
    me: who[S.user.uid] != null ? String(who[S.user.uid]) : null,
    taken: Object.keys(who).filter((u) => u !== S.user.uid).map((u) => String(who[u])),
    createdAt: Number(d.createdAt || 0),
  };
}
function toExpense(id, d) {
  // Los gastos borrados se quedan marcados (borrado suave de la app) y no cuentan.
  if (d.deleted === true || d.payerId == null || d.amountCents == null) return null;
  const shares = {};
  Object.keys(d.shares || {}).forEach((k) => { shares[k] = Number(d.shares[k]); });
  return { id, title: d.title || "", payerId: String(d.payerId), amountCents: Number(d.amountCents), shares, createdAt: Number(d.createdAt || 0), isTransfer: !!d.isTransfer };
}

// --- Cuentas: lo mismo que la app (Balances en Group.kt) ---
// Reparte con el método del mayor resto, como SplitCalculator.splitCents.
function splitCents(total, w) {
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return w.map(() => 0);
  const res = w.map((x) => Math.floor(total * x / sum));
  let rem = total - res.reduce((a, b) => a + b, 0);
  const order = w.map((_, i) => i).sort((a, b) => ((total * w[b]) % sum) - ((total * w[a]) % sum));
  for (const i of order) { if (rem <= 0) break; if (w[i] === 0) continue; res[i]++; rem--; }
  return res;
}
function equalShares(total, ids) { const p = splitCents(total, ids.map(() => 1)), o = {}; ids.forEach((id, i) => { o[id] = p[i]; }); return o; }
function balances(g, expenses) {
  const b = {};
  g.people.forEach((p) => { b[p.id] = 0; });
  expenses.forEach((e) => {
    b[e.payerId] = (b[e.payerId] || 0) + e.amountCents;
    Object.keys(e.shares).forEach((id) => { b[id] = (b[id] || 0) - e.shares[id]; });
  });
  return b;
}
// Los menos pagos posibles: subgrupos de saldo cero, cada uno con (personas - 1) pagos.
function settle(bal) {
  const open = Object.keys(bal).filter((k) => bal[k] !== 0).sort(cmpId).map((k) => [k, bal[k]]);
  if (!open.length) return [];
  if (open.length > 16) return greedy(open);
  const n = open.length, N = 1 << n, sum = new Array(N).fill(0), best = new Int32Array(N), from = new Int32Array(N);
  for (let m = 1; m < N; m++) { const low = 31 - Math.clz32(m & -m); sum[m] = sum[m & (m - 1)] + open[low][1]; }
  for (let m = 1; m < N; m++) {
    let top = -1;
    for (let i = 0; i < n; i++) { if (!(m & (1 << i))) continue; const v = best[m ^ (1 << i)]; if (v > top) { top = v; from[m] = i; } }
    best[m] = top + (sum[m] === 0 ? 1 : 0);
  }
  const out = [];
  let m = N - 1, grp = 0;
  while (m) {
    grp |= 1 << from[m]; m ^= 1 << from[m];
    if (sum[grp] === 0) { out.push(...greedy(open.filter((_, i) => grp & (1 << i)))); grp = 0; }
  }
  return out;
}
function greedy(entries) {
  const debt = entries.filter((e) => e[1] < 0).map((e) => [e[0], -e[1]]).sort((a, b) => b[1] - a[1]);
  const cred = entries.filter((e) => e[1] > 0).map((e) => [e[0], e[1]]).sort((a, b) => b[1] - a[1]);
  const out = [];
  let d = 0, c = 0;
  while (d < debt.length && c < cred.length) {
    const cents = Math.min(debt[d][1], cred[c][1]);
    out.push({ from: debt[d][0], to: cred[c][0], cents });
    debt[d][1] -= cents; cred[c][1] -= cents;
    if (debt[d][1] === 0) d++;
    if (cred[c][1] === 0) c++;
  }
  return out;
}

// --- Entrar ---
const GOOGLE_SVG = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style="vertical-align:-3px;margin-right:8px"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function loginError(e) {
  const c = (e && e.code) || "";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return null;
  if (c === "auth/popup-blocked") return tr("e_popup");
  if (c === "auth/unauthorized-domain" || c === "auth/operation-not-allowed" || c === "auth/unauthorized-continue-uri") return tr("e_setup");
  if (c === "auth/quota-exceeded") return tr("e_quota");
  if (c === "auth/invalid-action-code" || c === "auth/expired-action-code") return tr("e_badlink");
  if (c === "auth/network-request-failed") return tr("e_conn");
  return tr("e_login");
}

function renderLogin() {
  stopPolling();
  $("acct").hidden = true; $("fab").hidden = true; $("skel").hidden = true;
  header(tr("login_h1"), S.code ? tr("login_join") : tr("login_sub"));
  $("view").innerHTML =
    '<div class="card"><p style="margin-top:0">' + tr("login_text") + "</p>" +
    '<button class="btn google" id="google" type="button">' + GOOGLE_SVG + tr("google") + "</button>" +
    '<p class="or">' + tr("or_email") + "</p>" +
    '<form id="mailf"><input type="email" id="mail" required autocomplete="email" inputmode="email" placeholder="' + tr("email_ph") + '">' +
    '<button class="btn" type="submit">' + tr("send_link") + "</button></form></div>" +
    getAppNote();
  $("google").onclick = async () => {
    status("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { const m = loginError(e); if (m) status(esc(m), "bad"); }
  };
  $("mailf").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = $("mail").value.trim(), btn = ev.target.querySelector("button");
    btn.disabled = true; btn.textContent = tr("sending");
    try {
      const url = location.origin + "/g/" + (S.code ? "?c=" + S.code : "");
      await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
      store("distro.email", email);
      status(tr("link_sent", esc(email)));
    } catch (e) { status(esc(loginError(e)), "bad"); }
    btn.disabled = false; btn.textContent = tr("send_link");
  };
}

// Vuelta desde el enlace del correo. Si se abre en otro navegador, se pide el correo otra vez.
async function finishEmailLink() {
  if (!isSignInWithEmailLink(auth, location.href)) return;
  const done = () => history.replaceState(null, "", location.pathname + (S.code ? "?c=" + S.code : "") + location.hash);
  const email = load("distro.email");
  const tryWith = async (mail) => {
    try { await signInWithEmailLink(auth, mail, location.href); store("distro.email", null); done(); return true; }
    catch (e) { status(esc(loginError(e)), "bad"); if (e && (e.code === "auth/invalid-action-code" || e.code === "auth/expired-action-code")) done(); return false; }
  };
  if (email && await tryWith(email)) return;
  if (!isSignInWithEmailLink(auth, location.href)) return;
  await new Promise((resolve) => {
    $("skel").hidden = true;
    header(tr("login_h1"), tr("login_sub"));
    $("view").innerHTML = '<form class="card" id="again"><p style="margin-top:0">' + tr("email_again") + "</p>" +
      '<input type="email" id="mail2" required autocomplete="email" placeholder="' + tr("email_ph") + '">' +
      '<button class="btn on" type="submit">' + tr("finish") + "</button></form>";
    $("again").onsubmit = async (ev) => { ev.preventDefault(); if (await tryWith($("mail2").value.trim())) resolve(); };
  });
}

// --- Menú de la cuenta ---
function setupAccount() {
  const u = S.user, btn = $("acct"), menu = $("menu");
  btn.hidden = false;
  btn.textContent = tr("account");
  btn.onclick = (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) {
      menu.innerHTML = "<small>" + esc(tr("signed_as", u.email || u.displayName || "")) + "</small>" +
        '<button type="button" role="menuitem" id="m_out">' + tr("sign_out") + "</button>" +
        '<button type="button" role="menuitem" class="danger" id="m_del">' + tr("delete_acct") + "</button>";
      $("m_out").onclick = () => { menu.hidden = true; signOut(auth); };
      $("m_del").onclick = () => { menu.hidden = true; deleteAccount(); };
    }
  };
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
}

// Sale de todos los grupos (los que solo tienen a este usuario se borran) y elimina la cuenta.
async function deleteAccount() {
  if (!confirm(tr("confirm_delete"))) return;
  const user = auth.currentUser;
  // Firebase solo deja eliminar una cuenta con la sesión recién abierta: mejor pedirlo antes de tocar los grupos.
  if (Date.now() - Date.parse(user.metadata.lastSignInTime || 0) > 4 * 60 * 1000) { await signOut(auth); return status(esc(tr("e_relogin")), "warn"); }
  try {
    const uid = user.uid;
    for (const g of await myGroups()) {
      if (g.members <= 1) {
        const writes = [];
        for (const sub of ["expenses", "tickets"]) (await listDocs("groups/" + g.id + "/" + sub)).forEach((d) => writes.push({ delete: docName("groups/" + g.id + "/" + sub + "/" + d.id) }));
        writes.push({ delete: docName("groups/" + g.id) });
        await commit(writes);
      } else {
        await commit([{ update: { name: docName("groups/" + g.id), fields: {} }, updateMask: { fieldPaths: ["who." + tick(uid)] },
          updateTransforms: [{ fieldPath: "memberUids", removeAllFromArray: { values: [str(uid)] } }] }]);
      }
    }
    await deleteUser(user);
    status(esc(tr("deleted")));
  } catch (e) {
    if (e && e.code === "auth/requires-recent-login") { await signOut(auth); return status(esc(tr("e_relogin")), "warn"); }
    status(esc(tr("e_delete")), "bad");
  }
}

// --- Unirse con un código (el mismo de la app y de los enlaces /j/ y /t/) ---
async function join(code) {
  status(esc(tr("joining")));
  const inv = await getDoc("invites/" + code);
  if (!inv || !inv.groupId) { status(esc(tr("e_code")), "bad"); return null; }
  const uid = S.user.uid;
  // Las reglas piden apuntar en joins.{uid} el código vigente con el que se entra.
  await commit([{
    update: { name: docName("groups/" + inv.groupId), fields: { joins: mv({ [uid]: str(code) }) } },
    updateMask: { fieldPaths: ["joins." + tick(uid)] },
    updateTransforms: [{ fieldPath: "memberUids", appendMissingElements: { values: [str(uid)] } }],
    currentDocument: { exists: true },
  }]);
  status("");
  return inv.groupId;
}

// --- Pantallas ---
let pollTimer = null;
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

// Abre un grupo; si la dirección ya era esa no hay hashchange y se abre a mano.
function go(gid) { const h = "#/g/" + gid; if (location.hash === h) route(); else location.hash = h; }

async function route() {
  $("menu").hidden = true; closeSheet();
  const m = location.hash.match(/^#\/g\/(\d+)/);
  if (m) return openGroup(m[1]);
  return home();
}

function getAppNote() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "";
  return '<p class="center"><small><a href="https://play.google.com/store/apps/details?id=es.monarc.distro" style="color:var(--green)">' + tr("get_app") + "</a></small></p>";
}
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; const b = $("install"); if (b) b.hidden = false; });
function installNote() {
  const standalone = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: minimal-ui)").matches || navigator.standalone;
  if (standalone) return "";
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return '<p class="center"><small>' + tr("install_ios") + "</small></p>";
  return '<button class="btn" id="install" type="button"' + (installPrompt ? "" : " hidden") + ">" + tr("install") + "</button>";
}

async function home() {
  stopPolling();
  S.gid = null; $("fab").hidden = true;
  header(tr("home_h1"), S.groups ? plural(S.groups.length, "groups_1", "groups_n") : "");
  if (!S.groups) { $("view").innerHTML = ""; $("skel").hidden = false; }
  try { S.groups = (await myGroups()).sort((a, b) => a.createdAt - b.createdAt); }
  catch (e) { return status(esc(tr("e_conn")), "bad", home); }
  if (S.gid) return; // ya se ha abierto un grupo mientras cargaba
  $("skel").hidden = true;
  header(tr("home_h1"), plural(S.groups.length, "groups_1", "groups_n"));
  $("view").innerHTML =
    (S.groups.length ? S.groups.map((g) => '<a class="pick" href="#/g/' + g.id + '">' + avatar(g) +
      '<span class="grow"><span class="name">' + esc(g.name) + "</span><small>" + plural(g.people.length, "people_1", "people_n") + "</small></span></a>").join("")
      : '<div class="note">' + tr("no_groups") + "</div>") +
    '<form class="card" id="joinf"><label for="code" style="margin-top:0">' + tr("join_title") + "</label>" +
    '<div class="split"><input id="code" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="ABC123" style="letter-spacing:.15em;text-transform:uppercase">' +
    '<button type="submit" class="on" style="flex:0 0 auto;margin:6px 0">' + tr("join_btn") + "</button></div></form>" +
    installNote() + getAppNote();
  $("joinf").onsubmit = async (ev) => {
    ev.preventDefault();
    const code = clean($("code").value);
    if (!code) return status(esc(tr("e_code")), "bad");
    try { const gid = await join(code); if (gid) go(gid); }
    catch (e) { status(esc(tr("e_join")), "bad"); }
  };
  const ib = $("install");
  if (ib) ib.onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; ib.hidden = true; };
}

async function openGroup(gid) {
  if (S.gid !== gid) { S.gid = gid; S.group = null; S.sig = null; S.tab = "exp"; $("view").innerHTML = ""; $("skel").hidden = false; header("", ""); }
  $("fab").hidden = true;
  stopPolling();
  await refresh();
  // Los cambios de los demás se ven solos: se vuelve a leer cada 15 s con la página a la vista.
  pollTimer = setInterval(() => { if (document.visibilityState === "visible" && !S.busy && $("sheet").hidden) refresh(); }, 15000);
}

async function refresh() {
  const gid = S.gid;
  try {
    // Primero el grupo: si ya no eres miembro, las reglas tampoco dejan leer sus gastos.
    const d = await getDoc("groups/" + gid);
    const [ex, tk] = d ? await Promise.all([listDocs("groups/" + gid + "/expenses"), listDocs("groups/" + gid + "/tickets")]) : [[], []];
    if (gid !== S.gid) return;
    if (!d) { stopPolling(); $("fab").hidden = true; header(tr("home_h1")); $("view").innerHTML = '<p><a href="#/" class="link">' + tr("back") + "</a></p>"; return status(esc(tr("e_gone")), "bad"); }
    const sig = JSON.stringify([d, ex, tk.length]);
    if (sig === S.sig) return;
    S.sig = sig;
    S.group = toGroup(gid, d);
    S.expenses = ex.map((x) => toExpense(x.id, x.data)).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    S.tickets = tk.length;
    if ($("status").className.indexOf("bad") >= 0) status("");
    renderGroup();
  } catch (e) {
    if (gid !== S.gid) return;
    if (S.group) status(esc(tr("e_conn")), "warn"); else status(esc(tr("e_conn")), "bad", refresh);
  }
}

function personName(id) { const p = S.group.people.find((x) => x.id === id); return p ? p.name : "?"; }
function nameYou(id) { return personName(id) + (id === S.group.me ? " (" + tr("you") + ")" : ""); }
function myName() { return S.group && S.group.me ? personName(S.group.me) : (S.user.displayName || ""); }

function renderGroup() {
  const g = S.group;
  $("skel").hidden = true;
  const spent = S.expenses.filter((e) => !e.isTransfer).reduce((a, e) => a + e.amountCents, 0);
  header((g.icon ? g.icon + " " : "") + g.name, plural(g.people.length, "people_1", "people_n") + " · " + tr("spent", money(spent)));
  const meOk = g.me && g.people.some((p) => p.id === g.me);
  let h = '<p style="margin:10px 0 0"><a href="#/" class="link">' + tr("back") + "</a></p>";
  if (!meOk) h += whoCard();
  if (S.tickets) h += '<div class="note">' + esc(plural(S.tickets, "pending_1", "pending_n")) + "</div>";
  h += '<div class="tabs" role="tablist">' +
    '<button type="button" role="tab" data-tab="exp" aria-selected="' + (S.tab === "exp") + '">' + tr("tab_exp") + "</button>" +
    '<button type="button" role="tab" data-tab="bal" aria-selected="' + (S.tab === "bal") + '">' + tr("tab_bal") + "</button></div>";
  h += S.tab === "exp" ? expensesHtml() : balancesHtml();
  $("view").innerHTML = h;
  const fab = $("fab");
  fab.hidden = false; fab.textContent = tr("add_exp"); fab.onclick = openAddExpense;
  wireGroup();
}

function whoCard() {
  const g = S.group, own = (S.user.displayName || "").trim();
  // Se propone el nombre de la cuenta solo si nadie del grupo se llama ya así.
  const suggested = own && !g.people.some((p) => p.name.trim().toLowerCase() === own.toLowerCase()) ? own : "";
  return '<div class="card"><p style="margin-top:0"><b style="color:var(--ink);font-size:1.1rem">' + tr("who_title") + "</b><br>" + tr("who_hint") + "</p>" +
    g.people.map((p) => {
      const taken = g.taken.indexOf(p.id) >= 0;
      return '<button type="button" class="pick" data-who="' + p.id + '"><span class="av" aria-hidden="true">' + initial(p.name) + "</span><span>" + esc(p.name) +
        (taken ? "<small>" + tr("taken") + "</small>" : "") + "</span></button>";
    }).join("") +
    '<form id="addme"><label for="myname">' + tr("not_listed") + '</label><input id="myname" maxlength="60" required autocomplete="name" placeholder="' + tr("name_ph") + '" value="' + esc(suggested) + '">' +
    '<button class="btn" type="submit">' + tr("add_me") + "</button></form></div>";
}

function expensesHtml() {
  if (!S.expenses.length) return '<div class="note">' + tr("no_exp") + "</div>";
  const me = S.group.me;
  return '<div class="card">' + S.expenses.map((e) => {
    if (e.isTransfer) {
      const to = Object.keys(e.shares)[0];
      return '<div class="exp"><span class="av emoji" aria-hidden="true">↔</span><span class="grow"><span class="name">' + esc(nameYou(e.payerId)) + " → " + esc(to ? nameYou(to) : "?") +
        "</span><small>" + esc(e.title) + " · " + day(e.createdAt) + '</small></span><span class="amt">' + money(e.amountCents) + "</span></div>";
    }
    const mine = me && e.shares[me] ? " · " + tr("your_share", money(e.shares[me])) : "";
    return '<div class="exp"><span class="av" aria-hidden="true">' + initial(e.title) + '</span><span class="grow"><span class="name">' + esc(e.title) +
      "</span><small>" + esc(tr("paid_by", nameYou(e.payerId))) + " · " + day(e.createdAt) + esc(mine) + '</small></span><span class="amt">' + money(e.amountCents) + "</span></div>";
  }).join("") + "</div>";
}

function balancesHtml() {
  const g = S.group, bal = balances(g, S.expenses), me = g.me;
  const people = g.people.slice().sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0));
  let h = '<div class="card">' + people.map((p) => {
    const v = bal[p.id] || 0, cls = v > 0 ? "pos" : v < 0 ? "neg" : "";
    return '<div class="exp"><span class="av" aria-hidden="true">' + initial(p.name) + '</span><span class="grow name">' + esc(nameYou(p.id)) +
      '</span><span class="amt ' + cls + '">' + (v > 0 ? "+" : v < 0 ? "−" : "") + money(Math.abs(v)) + "</span></div>";
  }).join("") + '<small style="display:block;margin-top:6px">' + tr("bal_hint") + "</small></div>";
  const ts = settle(bal);
  h += "<h2>" + tr("settle_title") + "</h2>";
  if (!ts.length) return h + '<div class="note">' + tr("all_settled") + "</div>";
  h += '<div class="card">' + ts.map((t, i) => {
    const label = t.from === me ? tr("i_paid") : t.to === me ? tr("they_paid") : tr("mark_paid");
    const strong = t.from === me || t.to === me;
    return '<div class="tr"><div class="row"><span class="grow">' + esc(tr("pays", nameYou(t.from), nameYou(t.to))) + '</span><span class="amt">' + money(t.cents) + "</span></div>" +
      '<div class="acts"><button type="button" data-pay="' + i + '"' + (strong ? ' class="on"' : "") + ">" + label + "</button></div></div>";
  }).join("") + "</div>";
  S.transfers = ts;
  return h;
}

function wireGroup() {
  document.querySelectorAll("[data-tab]").forEach((b) => { b.onclick = () => { S.tab = b.dataset.tab; renderGroup(); }; });
  document.querySelectorAll("[data-who]").forEach((b) => { b.onclick = () => pickMe(b.dataset.who); });
  document.querySelectorAll("[data-pay]").forEach((b) => { b.onclick = () => markPaid(S.transfers[Number(b.dataset.pay)], b); });
  const f = $("addme");
  if (f) f.onsubmit = (ev) => { ev.preventDefault(); addMe($("myname").value.trim(), f.querySelector("button")); };
}

// --- Escrituras ---
const groupDoc = () => docName("groups/" + S.gid);
function activityWrite(kind, title, cents, by) {
  return {
    update: { name: docName("groups/" + S.gid + "/activity/" + autoId()), fields: {
      at: int(Date.now()), by: str(by != null ? by : myName()), kind: str(kind), title: str(title), amountCents: int(cents || 0), uid: str(S.user.uid),
    } },
    currentDocument: { exists: false },
  };
}
function expenseWrite(e) {
  const shares = {};
  Object.keys(e.shares).forEach((k) => { shares[k] = int(e.shares[k]); });
  return {
    update: { name: docName("groups/" + S.gid + "/expenses/" + e.id), fields: {
      title: str(e.title), payerId: int(e.payerId), amountCents: int(e.amountCents), shares: mv(shares),
      createdAt: int(e.createdAt), isTransfer: bool(e.isTransfer), updatedBy: str(S.user.uid),
    } },
    updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    currentDocument: { exists: false },
  };
}

async function guarded(fn, btn) {
  if (S.busy) return;
  S.busy = true;
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = tr("saving"); }
  try { await fn(); S.sig = null; await refresh(); return true; }
  catch (e) { console.warn(e); status(esc(tr("e_save")), "bad"); return false; }
  finally { S.busy = false; if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}

function pickMe(pid) {
  guarded(() => commit([{ update: { name: groupDoc(), fields: { who: mv({ [S.user.uid]: int(pid) }) } }, updateMask: { fieldPaths: ["who." + tick(S.user.uid)] } }]));
}

function addMe(name, btn) {
  if (!name) return;
  const pid = newId();
  guarded(() => commit([
    { update: { name: groupDoc(), fields: { who: mv({ [S.user.uid]: int(pid) }) } }, updateMask: { fieldPaths: ["who." + tick(S.user.uid)] },
      updateTransforms: [{ fieldPath: "people", appendMissingElements: { values: [mv({ id: int(pid), name: str(name) })] } }] },
    activityWrite("person_added", name, 0, name),
  ]), btn);
}

// Un reembolso es un gasto en el que quien debía paga a quien le debían (como settle() en GroupsViewModel).
function markPaid(t, btn) {
  if (!t || !confirm(tr("confirm_paid", personName(t.from), money(t.cents), personName(t.to)))) return;
  const e = { id: newId(), title: tr("refund"), payerId: t.from, amountCents: t.cents, shares: { [t.to]: t.cents }, createdAt: Date.now(), isTransfer: true };
  guarded(() => commit([expenseWrite(e), activityWrite("refund", e.title, e.amountCents)]), btn).then((ok) => { if (ok) flash(tr("paid_ok")); });
}

// --- Nuevo gasto (a partes iguales) ---
function closeSheet() { const s = $("sheet"); s.hidden = true; s.innerHTML = ""; }
function parseCents(s) {
  s = (s || "").trim().replace(/\s/g, "");
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(s)) return 0;
  return Math.round(parseFloat(s.replace(",", ".")) * 100);
}
function openAddExpense() {
  const g = S.group, sheet = $("sheet"), sel = new Set(g.people.map((p) => p.id));
  const payer = g.me && g.people.some((p) => p.id === g.me) ? g.me : (g.people[0] || {}).id;
  sheet.innerHTML = '<form id="expf" novalidate><h2>' + tr("new_exp") + "</h2>" +
    '<label for="ec">' + tr("concept") + '</label><input id="ec" maxlength="120" placeholder="' + tr("concept_ph") + '" autocomplete="off">' +
    '<label for="ea">' + tr("amount", esc(g.currency)) + '</label><input id="ea" inputmode="decimal" placeholder="0,00" autocomplete="off">' +
    '<label for="ep">' + tr("paid_by_lbl") + '</label><select id="ep">' + g.people.map((p) => '<option value="' + p.id + '"' + (p.id === payer ? " selected" : "") + ">" + esc(nameYou(p.id)) + "</option>").join("") + "</select>" +
    "<label>" + tr("between") + '</label><div class="chips" id="eb">' + g.people.map((p) => '<button type="button" aria-pressed="true" data-p="' + p.id + '">' + esc(p.name) + "</button>").join("") + "</div>" +
    '<small id="each"></small><p class="err" id="eerr" role="alert" style="color:var(--bad)"></p>' +
    '<div class="split"><button type="button" id="ecancel">' + tr("cancel") + '</button><button type="submit" class="on" id="esave">' + tr("save") + "</button></div></form>";
  sheet.hidden = false;
  const upd = () => { const c = parseCents($("ea").value), n = sel.size; $("each").textContent = c > 0 && n ? tr("each", money(Math.floor(c / n))) : ""; };
  $("eb").onclick = (ev) => {
    const b = ev.target.closest("button[data-p]"); if (!b) return;
    const id = b.dataset.p; if (sel.has(id)) sel.delete(id); else sel.add(id);
    b.setAttribute("aria-pressed", String(sel.has(id))); upd();
  };
  $("ea").oninput = upd;
  $("ecancel").onclick = closeSheet;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  setTimeout(() => $("ec").focus(), 50);
  $("expf").onsubmit = async (ev) => {
    ev.preventDefault();
    const title = $("ec").value.trim(), cents = parseCents($("ea").value), err = $("eerr");
    if (!title) return (err.textContent = tr("e_concept"));
    if (cents <= 0) return (err.textContent = tr("e_amount"));
    const ids = g.people.map((p) => p.id).filter((id) => sel.has(id));
    if (!ids.length) return (err.textContent = tr("e_between"));
    err.textContent = "";
    const e = { id: newId(), title, payerId: $("ep").value, amountCents: cents, shares: equalShares(cents, ids), createdAt: Date.now(), isTransfer: false };
    const ok = await guarded(() => commit([expenseWrite(e), activityWrite("expense_added", title, cents)]), $("esave"));
    if (ok) { closeSheet(); S.tab = "exp"; renderGroup(); flash(tr("saved")); }
    else err.textContent = tr("e_save");
  };
}

// --- Arranque ---
addEventListener("hashchange", () => { if (S.user) route(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.user && S.gid && !S.busy) refresh(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet(); $("menu").hidden = true; } });

let started = false;
(async () => {
  try { await finishEmailLink(); } catch (e) { console.warn(e); }
  onAuthStateChanged(auth, async (user) => {
    S.user = user; S.groups = null; S.gid = null;
    if (!user) { started = false; return renderLogin(); }
    status("");
    if (!started) { started = true; setupAccount(); }
    if (S.code) {
      const code = S.code;
      S.code = null;
      history.replaceState(null, "", location.pathname + location.hash);
      try { const gid = await join(code); if (gid) return go(gid); }
      catch (e) { console.warn(e); status(esc(tr("e_join")), "bad"); }
    }
    route();
  });
})();
