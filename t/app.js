// Marcar lo tuyo en un ticket sin instalar nada (montarc.es/t/). Va en un archivo aparte para que la
// página no necesite permitir scripts en línea (pentest 2026-11-10, B5).
"use strict";
// Clave pública de la app web de Firebase: no es un secreto; los datos los protegen las reglas de Firestore.
var KEY = "AIzaSyBGyMSB2-HcDlcOwm9XJ-Qt5k5lcybBgoU", PROJECT = "distro-58a19";
var DOCS = "projects/" + PROJECT + "/databases/(default)/documents";
var API = "https://firestore.googleapis.com/v1/" + DOCS;
var q = new URLSearchParams(location.search);
var code = (q.get("c") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
var ticketId = (q.get("t") || "").replace(/\D/g, "");
var $ = function (id) { return document.getElementById(id); };
var S = { last: null, uid: null, token: null, group: null, groupId: null, ticket: null, me: null, busy: false };

function fail(msg, retry) { $("skel").hidden = true; var n = $("status"); n.className = "note bad"; n.textContent = msg; if (retry) { var r = document.createElement("button"); r.id = "retry"; r.textContent = tr("retry"); n.appendChild(document.createElement("br")); n.appendChild(r); } }
function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

// --- Sesión anónima (se guarda para volver con la misma cuenta) ---
async function auth() {
  var rt = load("distro.rt");
  if (rt) {
    var r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + KEY, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(rt)
    });
    if (r.ok) { var j = await r.json(); S.token = j.id_token; S.uid = j.user_id; store("distro.rt", j.refresh_token); return; }
  }
  var s = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + KEY, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true })
  });
  if (!s.ok) throw new Error("auth");
  var d = await s.json(); S.token = d.idToken; S.uid = d.localId; store("distro.rt", d.refreshToken);
}

async function call(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ "Authorization": "Bearer " + S.token, "Content-Type": "application/json" }, opts.headers || {});
  var r = await fetch(url, opts);
  if (r.status === 401) { await auth(); opts.headers.Authorization = "Bearer " + S.token; r = await fetch(url, opts); }
  return r;
}

// --- Valores de Firestore. Los enteros se dejan como texto: los ids no caben en un número de JS. ---
function dec(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return v.integerValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("mapValue" in v) { var o = {}, f = v.mapValue.fields || {}; for (var k in f) o[k] = dec(f[k]); return o; }
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
  return null;
}
function mv(fields) { return { mapValue: { fields: fields } }; }
function kv(k, v) { var o = {}; o[k] = v; return o; }
function int(x) { return { integerValue: String(x) }; }
var tick = function (s) { return "`" + s + "`"; };

async function getDoc(path) {
  var r = await call(API + "/" + path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(path + " " + r.status);
  return dec({ mapValue: { fields: (await r.json()).fields || {} } });
}
async function patch(path, mask, fields) {
  var qs = mask.map(function (m) { return "updateMask.fieldPaths=" + encodeURIComponent(m); }).join("&");
  var r = await call(API + "/" + path + "?" + qs, { method: "PATCH", body: JSON.stringify({ fields: fields }) });
  if (!r.ok) throw new Error("patch " + r.status);
}
// Añadir o quitar un elemento de una lista sin pisar a los demás (como arrayUnion/arrayRemove).
async function listChange(path, field, values, add) {
  var t = { fieldPath: field };
  t[add ? "appendMissingElements" : "removeAllFromArray"] = { values: values };
  var r = await call("https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents:commit", {
    method: "POST", body: JSON.stringify({ writes: [{ transform: { document: DOCS + "/" + path, fieldTransforms: [t] } }] })
  });
  if (!r.ok) throw new Error("commit " + r.status);
}

// Entrar como invitado del ticket: las reglas piden apuntar en joins.{uid} el código vigente y
// añadirse a ticketGuests (NO a memberUids): así se lee el grupo y el ticket y se marca lo propio,
// pero sin ver los gastos ni poder borrar el grupo.
async function joinGroup() {
  var url = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents:commit";
  var add = [{ fieldPath: "ticketGuests", appendMissingElements: { values: [{ stringValue: S.uid }] } }];
  var send = function (writes) { return call(url, { method: "POST", body: JSON.stringify({ writes: writes }) }); };
  // El código va en una prueba que nadie puede leer (groups/{id}/joins/{uid}): antes iba en el grupo,
  // a la vista de todos los invitados (pentest 2026-11-04, E1).
  var r = await send([
    { update: { name: DOCS + "/groups/" + S.groupId + "/joins/" + S.uid, fields: { code: { stringValue: code } } } },
    { transform: { document: DOCS + "/groups/" + S.groupId, fieldTransforms: add }, currentDocument: { exists: true } }
  ]);
  // Reglas aún sin la prueba: el camino antiguo, con el código en joins.{uid}.
  if (!r.ok) r = await send([{
    update: { name: DOCS + "/groups/" + S.groupId, fields: { joins: mv(kv(S.uid, { stringValue: code })) } },
    updateMask: { fieldPaths: ["joins." + tick(S.uid)] }, updateTransforms: add, currentDocument: { exists: true }
  }]);
  // Quien ya entró antes (al volver a abrir el enlace) no puede «volver a entrar», pero ya lee el grupo.
  if (!r.ok && !(await getDoc("groups/" + S.groupId).catch(function () { return null; }))) throw new Error("join " + r.status);
}

// --- Idioma: español o inglés según el navegador (o ?lang=es / ?lang=en) ---
var LANG = (function (l) { l = l.toLowerCase(); return l.indexOf("ca") === 0 ? "ca" : l.indexOf("es") === 0 ? "es" : "en"; })(new URLSearchParams(location.search).get("lang") || navigator.language || "en");
var LOC = { es: "es-ES", ca: "ca-ES", en: "en-IE" }[LANG];
var TX = {"page_title": {"es": "Marcar un ticket en Distro", "en": "Mark your items on Distro", "ca": "Marcar un tiquet a Distro"}, "title_default": {"es": "Tu ticket", "en": "Your receipt", "ca": "El teu tiquet"}, "ad_label": {"es": "Publicidad", "en": "Advertisement", "ca": "Publicitat"}, "ad_title": {"es": "Distro: reparte los gastos sin hacer cuentas", "en": "Distro: split expenses without the math", "ca": "Distro: reparteix les despeses sense fer comptes"}, "ad_text": {"es": "Escanea el ticket y cada uno marca lo suyo.", "en": "Scan the receipt and everyone marks their own.", "ca": "Escaneja el tiquet i cadascú marca el seu."}, "foot": {"es": "Quien pagó cierra el ticket desde la app o la web y se reparte.", "en": "Whoever paid closes the receipt from the app or the web and it gets split.", "ca": "Qui va pagar tanca el tiquet des de l'app o el web i es reparteix."}, "your_share": {"es": "Tu parte", "en": "Your share", "ca": "La teva part"}, "approx": {"es": "(aprox.)", "en": "(approx.)", "ca": "(aprox.)"}, "confirm": {"es": "Confirmar mi parte", "en": "Confirm my share", "ca": "Confirmar la meva part"}, "retry": {"es": "Reintentar", "en": "Retry", "ca": "Tornar-ho a provar"}, "e_link": {"es": "Este enlace no es válido. Pídele a quien te lo envió que lo mande otra vez.", "en": "This link isn't valid. Ask whoever sent it to send it again.", "ca": "Aquest enllaç no és vàlid. Demana a qui te l'ha enviat que el torni a enviar."}, "e_conn": {"es": "No se ha podido conectar. Revisa tu conexión.", "en": "Couldn't connect. Check your connection.", "ca": "No s'ha pogut connectar. Revisa la connexió."}, "e_expired": {"es": "El enlace ha caducado. Pídele a quien te lo envió que lo mande otra vez.", "en": "The link has expired. Ask whoever sent it to send it again.", "ca": "L'enllaç ha caducat. Demana a qui te l'ha enviat que el torni a enviar."}, "e_join": {"es": "No se ha podido entrar en el grupo.", "en": "Couldn't join the group.", "ca": "No s'ha pogut entrar al grup."}, "e_gone": {"es": "El grupo ya no existe.", "en": "The group no longer exists.", "ca": "El grup ja no existeix."}, "e_closed": {"es": "Este ticket ya está cerrado: quien pagó lo apuntó como gasto en Distro. ¡Gracias por marcar lo tuyo!", "en": "This receipt is already closed: whoever paid saved it as an expense in Distro. Thanks for marking yours!", "ca": "Aquest tiquet ja està tancat: qui va pagar el va apuntar com a despesa a Distro. Gràcies per marcar el teu!"}, "e_retrying": {"es": "Sin conexión; reintentando…", "en": "Offline; retrying…", "ca": "Sense connexió; tornant-ho a provar…"}, "e_offline": {"es": "Sin conexión: tus cambios se guardarán cuando vuelva.", "en": "Offline: your changes will be saved when it's back.", "ca": "Sense connexió: els teus canvis es desaran quan torni."}, "group_label": {"es": "Grupo «{0}»", "en": "Group “{0}”", "ca": "Grup «{0}»"}, "you": {"es": "Tú", "en": "You", "ca": "Tu"}, "and": {"es": " y ", "en": " and ", "ca": " i "}, "missing": {"es": "Faltan por asignar <b>{0}</b> de {1} artículos.", "en": "<b>{0}</b> of {1} items still unassigned.", "ca": "Falten per assignar <b>{0}</b> de {1} articles."}, "all_owned": {"es": "✓ Todo tiene dueño.", "en": "✓ Everything has an owner.", "ca": "✓ Tot té amo."}, "marking_as": {"es": "Marcas como <b>{0}</b>", "en": "Marking as <b>{0}</b>", "ca": "Marques com a <b>{0}</b>"}, "not_me": {"es": "No soy yo", "en": "That's not me", "ca": "No sóc jo"}, "f_all": {"es": "Todos", "en": "All", "ca": "Tots"}, "f_free": {"es": "Sin asignar", "en": "Unassigned", "ca": "Sense assignar"}, "f_mine": {"es": "Lo mío", "en": "Mine", "ca": "El meu"}, "none_free": {"es": "No queda nada sin asignar. 🎉", "en": "Nothing left unassigned. 🎉", "ca": "No queda res sense assignar. 🎉"}, "none_mine": {"es": "Todavía no has marcado nada.", "en": "You haven't marked anything yet.", "ca": "Encara no has marcat res."}, "progress": {"es": "{0} de {1} repartidos", "en": "{0} of {1} assigned", "ca": "{0} de {1} repartits"}, "saved_btn": {"es": "✓ Tu parte está guardada", "en": "✓ Your share is saved", "ca": "✓ La teva part està desada"}, "dirty": {"es": "Tienes cambios sin guardar.", "en": "You have unsaved changes.", "ca": "Tens canvis sense desar."}, "saved_hint": {"es": "Puedes volver a cambiarlo cuando quieras.", "en": "You can change it again any time.", "ca": "Ho pots tornar a canviar quan vulguis."}, "mark_hint": {"es": "Marca lo tuyo y pulsa Confirmar.", "en": "Mark yours and tap Confirm.", "ca": "Marca el teu i prem Confirmar."}, "saving": {"es": "Guardando…", "en": "Saving…", "ca": "Desant…"}, "save_fail": {"es": "No se ha podido guardar. Inténtalo de nuevo.", "en": "Couldn't save. Please try again.", "ca": "No s'ha pogut desar. Torna-ho a provar."}, "discard_q": {"es": "Tienes cambios sin guardar. ¿Descartarlos?", "en": "You have unsaved changes. Discard them?", "ca": "Tens canvis sense desar. Vols descartar-los?"}, "between": {"es": "Entre {0}", "en": "Between {0}", "ca": "Entre {0}"}, "shared_by": {"es": "{0} a medias", "en": "{0} (shared)", "ca": "{0} a mitges"}, "left_n": {"es": "Quedan {0}", "en": "{0} left", "ca": "En queden {0}"}, "unassigned": {"es": "Sin asignar", "en": "Unassigned", "ca": "Sense assignar"}, "mine_btn": {"es": "Es mío", "en": "Mine", "ca": "És meu"}, "mine_on": {"es": "✓ Es mío", "en": "✓ Mine", "ca": "✓ És meu"}, "taken": {"es": "Ya está repartido", "en": "Already taken", "ca": "Ja està repartit"}, "split_btn": {"es": "Repartir ▾", "en": "Split ▾", "ca": "Repartir ▾"}, "share_btn": {"es": "Compartir ▾", "en": "Share ▾", "ca": "Compartir ▾"}, "close": {"es": "Cerrar", "en": "Close", "ca": "Tancar"}, "whole_equal": {"es": "Todo el artículo se divide a partes iguales", "en": "The whole item is split equally", "ca": "Tot l'article es divideix a parts iguals"}, "nobody": {"es": "Nadie todavía", "en": "Nobody yet", "ca": "Encara ningú"}, "remove_me": {"es": "Quitarme", "en": "Remove me", "ca": "Treure'm"}, "join_me": {"es": "Apuntarme", "en": "Count me in", "ca": "Apuntar-me"}, "to_units": {"es": "Repartir por unidades o porciones", "en": "Split by units or portions", "ca": "Repartir per unitats o porcions"}, "just_me": {"es": "Para mí solo", "en": "Just for me", "ca": "Només per a mi"}, "rm_unit": {"es": "Quitar una unidad", "en": "Remove one", "ca": "Treure una unitat"}, "add_unit": {"es": "Añadir una unidad", "en": "Add one", "ca": "Afegir una unitat"}, "left_unassigned": {"es": "Quedan {0} sin asignar", "en": "{0} unassigned", "ca": "En queden {0} sense assignar"}, "all_taken": {"es": "Ya están repartidas", "en": "All taken", "ca": "Ja estan repartides"}, "with_others": {"es": "A medias con otros", "en": "Shared with others", "ca": "A mitges amb altres"}, "sharing_it": {"es": "Compartirlo", "en": "Sharing it", "ca": "Compartir-lo"}, "hint_multi": {"es": "Si algunas unidades las compartís, ábrelas aquí: cada una se divide entre quienes se apuntan.", "en": "If you share some units, open them here: each one is split among whoever joins.", "ca": "Si compartiu algunes unitats, obre-les aquí: cadascuna es divideix entre qui s'hi apunta."}, "hint_single": {"es": "Si lo compartís, ábrelo aquí y que se apunte quien lo ha tomado.", "en": "If you share it, open it here and let whoever had it join.", "ca": "Si el compartiu, obre'l aquí i que s'hi apunti qui n'ha pres."}, "one_unit": {"es": "1 unidad: ", "en": "1 unit: ", "ca": "1 unitat: "}, "share_unit": {"es": "+ Compartir una unidad con otros", "en": "+ Share one unit with others", "ca": "+ Compartir una unitat amb altres"}, "share_with": {"es": "+ Compartirlo con otros", "en": "+ Share it with others", "ca": "+ Compartir-lo amb altres"}, "who_title": {"es": "¿Quién eres?", "en": "Who are you?", "ca": "Qui ets?"}, "who_hint": {"es": "Elige tu nombre para marcar lo tuyo.", "en": "Pick your name to mark your items.", "ca": "Tria el teu nom per marcar el teu."}, "last_you": {"es": "La última vez fuiste tú", "en": "That was you last time", "ca": "L'última vegada vas ser tu"}, "not_listed": {"es": "¿No estás en la lista?", "en": "Not on the list?", "ca": "No ets a la llista?"}, "name_ph": {"es": "Escribe tu nombre", "en": "Type your name", "ca": "Escriu el teu nom"}, "add_me": {"es": "Añadirme al grupo", "en": "Add me to the group", "ca": "Afegir-me al grup"}, "adding": {"es": "Añadiendo…", "en": "Adding…", "ca": "Afegint…"}, "add_fail": {"es": "No se ha podido añadirte. Inténtalo de nuevo.", "en": "Couldn't add you. Please try again.", "ca": "No s'ha pogut afegir-te. Torna-ho a provar."}, "your_part": {"es": "Tu parte", "en": "Your share", "ca": "La teva part"}, "have_app": {"es": "¿Tienes Distro? Ábrelo en la app: entrarás en el grupo y verás el ticket.", "en": "Have Distro? Open it in the app: you'll join the group and see the receipt.", "ca": "Tens Distro? Obre-ho a l'app: entraràs al grup i veuràs el tiquet."}, "open_app": {"es": "Abrir en Distro", "en": "Open in Distro", "ca": "Obrir a Distro"}, "see_group": {"es": "Ver los saldos del grupo en la web", "en": "See the group's balances on the web", "ca": "Veure els saldos del grup al web"}, "get_app": {"es": "Descargar Distro en Google Play", "en": "Get Distro on Google Play", "ca": "Descarregar Distro a Google Play"}};
function tr(k) { var s = (TX[k] || {})[LANG] || k; for (var i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(arguments[i]); return s; }
function applyStatic() {
  document.documentElement.lang = LANG; document.title = tr("page_title");
  [].forEach.call(document.querySelectorAll("[data-tr]"), function (n) { n.textContent = tr(n.getAttribute("data-tr")); });
}

// --- Arranque ---
async function start() {
  applyStatic();
  if (code.length !== 6 || !ticketId) return fail(tr("e_link"));
  // Con la app instalada el enlace suele abrirla directamente; si no, este botón la abre.
  if (/Android/i.test(navigator.userAgent)) {
    $("openapp").href = "distro://t?c=" + code + "&t=" + ticketId;
    $("inapp").hidden = false;
  }
  try { await auth(); } catch (e) { return fail(tr("e_conn"), true); }
  var inv = await getDoc("invites/" + code).catch(function () { return null; });
  if (!inv || !isId(inv.groupId)) return fail(tr("e_expired"));
  S.groupId = inv.groupId;
  try { await joinGroup(); }
  catch (e) { return fail(tr("e_join"), true); }
  S.last = load("distro.me." + S.groupId);
  await refresh();
  setInterval(function () { if (!S.busy) refresh(); }, 4000);
}

async function refresh(force) {
  try {
    var g = await getDoc("groups/" + S.groupId), t = await getDoc("groups/" + S.groupId + "/tickets/" + ticketId);
    if (!g) return fail(tr("e_gone"));
    if (!t) return fail(tr("e_closed"));
    offline(false);
    var sig = JSON.stringify([g, t]);
    if (!force && sig === S.sig) return; // nada nuevo: no se repinta (evita parpadeos y toques perdidos)
    S.sig = sig; S.group = cleanGroup(g); S.ticket = cleanTicket(t); render();
  } catch (e) { if (S.ticket) offline(true); else fail(tr("e_retrying")); }
}
function offline(on) { var n = $("status"); if (S.ticket) { n.className = on ? "note warn" : ""; n.textContent = on ? tr("e_offline") : ""; } }

// --- Utilidades ---
// Para texto y para valores de atributos: también las comillas.
function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
// Los ids son enteros (como en la app). Lo que no lo sea se descarta: un invitado puede escribir
// personas y lo marcado de un ticket, y las reglas no validan su forma.
function isId(x) { return typeof x === "string" && /^\d{1,19}$/.test(x); }
function ids(a) { return (Array.isArray(a) ? a : []).filter(isId); }
function cleanGroup(g) {
  g.people = (Array.isArray(g.people) ? g.people : []).filter(function (p) { return p && isId(p.id); })
    .map(function (p) { return { id: p.id, name: typeof p.name === "string" && p.name ? p.name : "?" }; });
  return g;
}
function cleanTicket(t) {
  t.items = (Array.isArray(t.items) ? t.items : []).filter(function (it) { return it && isId(it.id); }).map(function (it) {
    return { id: it.id, name: typeof it.name === "string" ? it.name : "", quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)), totalCents: Math.max(0, Math.floor(Number(it.totalCents) || 0)) };
  });
  var c = t.claims && typeof t.claims === "object" ? t.claims : {}, out = {};
  Object.keys(c).filter(isId).forEach(function (k) {
    var a = c[k] || {}, units = {}, slots = {};
    Object.keys(a.units || {}).filter(isId).forEach(function (p) { var n = Math.floor(Number(a.units[p]) || 0); if (n > 0) units[p] = n; });
    Object.keys(a.slots || {}).filter(isId).forEach(function (sl) { slots[sl] = ids(a.slots[sl]); });
    out[k] = { units: units, shared: a.shared === true, sharedBy: ids(a.sharedBy), slots: slots };
  });
  t.claims = out;
  return t;
}
function eur(c) {
  // Moneda del grupo (si falta o no es válida, euros).
  var cur = S.group && /^[A-Z]{3}$/.test(S.group.currency || "") ? S.group.currency : "EUR";
  try { return (Number(c) / 100).toLocaleString(LOC, { style: "currency", currency: cur }); }
  catch (e) { return (Number(c) / 100).toLocaleString(LOC, { style: "currency", currency: "EUR" }); }
}
function personName(id) { var p = (S.group.people || []).find(function (x) { return x.id === id; }); return p ? p.name : "?"; }
function initial(n) { return esc((n || "?").trim().charAt(0).toUpperCase() || "?"); }
function nameList(ids) { // «Tú, Sara y Gonzalo»
  var order = (S.group.people || []).map(function (p) { return p.id; });
  ids = ids.slice().sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  var n = ids.map(function (p) { return p === S.me ? tr("you") : personName(p); });
  return n.length > 1 ? n.slice(0, -1).join(", ") + tr("and") + n[n.length - 1] : (n[0] || "");
}

// --- Reparto: mismo cálculo que la app (SplitCalculator.kt), con el método del mayor resto ---
function splitCents(total, w) {
  var sum = w.reduce(function (a, b) { return a + b; }, 0);
  if (sum <= 0) return w.map(function () { return 0; });
  var res = w.map(function (x) { return Math.floor(total * x / sum); });
  var rem = total - res.reduce(function (a, b) { return a + b; }, 0);
  var order = w.map(function (_, i) { return i; }).sort(function (a, b) { return ((total * w[b]) % sum) - ((total * w[a]) % sum); });
  for (var k = 0; k < order.length && rem > 0; k++) { if (w[order[k]] === 0) continue; res[order[k]]++; rem--; }
  return res;
}
// v = { units:{pid:n}, slots:[[pid..]..] (por id de porción), sh, sharedBy:[pid] }  ->  { by:{pid:cents}, un:cents, free:n }
function compute(it, v) {
  var people = S.group.people || [], by = {}, cents = Number(it.totalCents), q = Number(it.quantity) || 1;
  people.forEach(function (p) { by[p.id] = 0; });
  if (v.sh) {
    var sharers = people.filter(function (p) { return v.sharedBy.indexOf(p.id) >= 0; });
    if (!sharers.length) return { by: by, un: cents, free: q };
    var parts = splitCents(cents, sharers.map(function () { return 1; }));
    sharers.forEach(function (p, i) { by[p.id] += parts[i]; });
    return { by: by, un: 0, free: 0 };
  }
  var cl = people.filter(function (p) { return (v.units[p.id] || 0) > 0; });
  var sl = v.slots.map(function (ids) { return people.filter(function (p) { return ids.indexOf(p.id) >= 0; }); }).filter(function (s) { return s.length; });
  var claimed = cl.reduce(function (n, p) { return n + v.units[p.id]; }, 0) + sl.length, free = Math.max(0, q - claimed);
  var w = cl.map(function (p) { return v.units[p.id]; }).concat(sl.map(function () { return 1; }), [free]);
  var ps = splitCents(cents, w);
  cl.forEach(function (p, i) { by[p.id] += ps[i]; });
  sl.forEach(function (s, k) { var e = splitCents(ps[cl.length + k], s.map(function () { return 1; })); s.forEach(function (p, i) { by[p.id] += e[i]; }); });
  return { by: by, un: ps[ps.length - 1], free: free, over: claimed > q };
}

// --- Estado del artículo: lo que hay en el servidor y mi borrador encima ---
var draft = {}, dirty = {}, hasSaved = false;
function claim(it) { return (S.ticket.claims || {})[it.id] || {}; }
function serverSlots(it) { // { slotId: [pid] } sin porciones vacías, ordenadas por id
  var s = claim(it).slots || {}, o = {};
  Object.keys(s).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) { if ((s[k] || []).length) o[k] = s[k]; });
  return o;
}
function server(it) {
  var a = claim(it), sb = a.sharedBy || [], sl = serverSlots(it);
  return { u: Number((a.units || {})[S.me] || 0), sh: a.shared === true, inn: sb.indexOf(S.me) >= 0,
    sl: Object.keys(sl).filter(function (k) { return sl[k].indexOf(S.me) >= 0; }) };
}
function val(it) { return dirty[it.id] ? draft[it.id] : server(it); }
// Vista completa del artículo con mi borrador aplicado.
function view(it) {
  var a = claim(it), d = val(it), units = {}, i, k;
  for (k in (a.units || {})) if (k !== S.me) units[k] = Number(a.units[k]);
  if (d.u > 0) units[S.me] = d.u;
  var sl = serverSlots(it), all = {};
  for (k in sl) all[k] = sl[k].filter(function (p) { return p !== S.me; });
  d.sl.forEach(function (k) { all[k] = (all[k] || []).concat([S.me]); });
  var ids = Object.keys(all).filter(function (k) { return all[k].length; }).sort(function (x, y) { return Number(x) - Number(y); });
  var sb = (a.sharedBy || []).filter(function (p) { return p !== S.me; }); if (d.inn) sb.push(S.me);
  return { units: units, slotIds: ids, slots: ids.map(function (k) { return all[k]; }), sh: d.sh, sharedBy: sb };
}
function change(id, fn) {
  var it = S.ticket.items.find(function (x) { return x.id === id; }), d = val(it);
  var nd = { u: d.u, sh: d.sh, inn: d.inn, sl: d.sl.slice() }; fn(nd, view(it), it);
  if (JSON.stringify(nd) === JSON.stringify(d)) return;
  draft[id] = nd; dirty[id] = true; hasSaved = false; render();
}
function pending() { return Object.keys(dirty).length; }
window.addEventListener("beforeunload", function (e) { if (pending()) { e.preventDefault(); e.returnValue = ""; } });

// --- Pantalla ---
S.filter = "all"; S.open = null;
function render() {
  $("skel").hidden = true; $("foot").hidden = false;
  $("group").textContent = tr("group_label", S.group.name);
  $("title").textContent = S.ticket.title || "Ticket"; document.title = (S.ticket.title || "Ticket") + " · Distro";
  var people = S.group.people || [];
  if (!S.me || !people.some(function (p) { return p.id === S.me; })) return renderWho(people);
  $("who").hidden = true; $("ad").hidden = false;
  var list = S.ticket.items || [], total = 0, ticketTotal = 0, done = 0, rows = [], counts = { all: list.length, free: 0, mine: 0 };
  list.forEach(function (it) {
    var v = view(it), r = compute(it, v), q = Number(it.quantity) || 1, cents = Number(it.totalCents), d = val(it);
    var mine = r.by[S.me] || 0, isFree = r.free > 0; total += mine; ticketTotal += cents;
    if (!isFree) done++; else counts.free++;
    if (mine > 0) counts.mine++;
    rows.push({ it: it, v: v, r: r, q: q, cents: cents, d: d, mine: mine, isFree: isFree });
  });
  var shown = rows.filter(function (x) { return S.filter === "all" || (S.filter === "free" ? x.isFree : x.mine > 0); });
  var html = "";
  if (S.filter !== "all" && !shown.length) html = '<p style="text-align:center">' + (S.filter === "free" ? tr("none_free") : tr("none_mine")) + "</p>";
  shown.forEach(function (x) { html += itemHtml(x); });
  var left = list.length - done;
  var head = '<div class="me"><span class="av" aria-hidden="true">' + initial(personName(S.me)) + '</span><span>' + tr("marking_as", esc(personName(S.me))) + '<br><a href="#" data-a="chg">' + tr("not_me") + '</a></span></div>' +
    (left > 0 ? '<div class="note warn">' + tr("missing", left, list.length) + '</div>' : '<div class="note">' + tr("all_owned") + '</div>');
  $("items").innerHTML = head + html;
  var f = $("filters"); f.hidden = list.length < 5;
  f.innerHTML = [["all", tr("f_all"), counts.all], ["free", tr("f_free"), counts.free], ["mine", tr("f_mine"), counts.mine]].map(function (c) {
    return '<button class="' + (S.filter === c[0] ? "on" : "") + '" data-a="f" data-f="' + c[0] + '" aria-pressed="' + (S.filter === c[0]) + '">' + c[1] + " · " + c[2] + "</button>";
  }).join("");
  $("prog").hidden = false; $("progtxt").textContent = tr("progress", done, list.length); $("ticktotal").textContent = eur(ticketTotal);
  $("progbar").style.width = (list.length ? Math.round(done * 100 / list.length) : 0) + "%";
  $("mine").hidden = false; $("total").textContent = eur(total);
  var n = pending(), ok = $("ok"), sv = $("saved");
  ok.disabled = n === 0 || S.busy;
  ok.textContent = n ? tr("confirm") : hasSaved ? tr("saved_btn") : tr("confirm");
  if (n) { sv.className = "dirty"; sv.textContent = tr("dirty"); }
  else if (hasSaved) { sv.className = "okmsg"; sv.textContent = tr("saved_hint"); }
  else { sv.className = ""; sv.textContent = tr("mark_hint"); }
}

// Quién tiene qué, en etiquetas cortas.
function tagsHtml(x) {
  var v = x.v, t = [];
  if (v.sh) {
    if (v.sharedBy.length) t.push('<span class="tag' + (v.sharedBy.indexOf(S.me) >= 0 ? " me" : "") + '">' + tr("between", esc(nameList(v.sharedBy))) + '</span>');
  } else {
    (S.group.people || []).forEach(function (p) {
      var n = v.units[p.id] || 0; if (n > 0) t.push('<span class="tag' + (p.id === S.me ? " me" : "") + '">' + (p.id === S.me ? tr("you") : esc(p.name)) + (x.q > 1 ? " ×" + n : "") + '</span>');
    });
    v.slots.forEach(function (ids) { t.push('<span class="tag' + (ids.indexOf(S.me) >= 0 ? " me" : "") + '">' + tr("shared_by", esc(nameList(ids))) + '</span>'); });
  }
  if (x.isFree) t.push('<span class="tag free">' + (x.q > 1 && x.r.free < x.q ? tr("left_n", x.r.free) : tr("unassigned")) + '</span>');
  return t.join("");
}

function itemHtml(x) {
  var it = x.it, id = it.id, open = S.open === id, v = x.v, d = x.d, q = x.q;
  var mineUnits = v.units[S.me] || 0, othersUnits = Object.keys(v.units).reduce(function (n, p) { return n + (p === S.me ? 0 : v.units[p]); }, 0);
  var h = '<div class="card item' + (x.mine > 0 ? " mine" : "") + (open ? " open" : "") + '"><div class="top" data-a="o" data-i="' + id + '"><span><span class="name">' + esc(it.name) + '</span>' +
    (q > 1 ? '<br><small>' + q + " × " + eur(x.cents / q) + '</small>' : "") + '</span><span style="text-align:right"><span class="price">' + eur(x.cents) + '</span>' +
    (x.mine > 0 ? '<br><small style="color:var(--green);font-weight:700">' + tr("your_part") + ' ' + eur(x.mine) + '</small>' : "") + '</span></div>' +
    '<div class="line"><div class="sub">' + tagsHtml(x) + '</div><div class="acts">';
  if (q === 1 && !v.sh) {
    var taken = x.r.free <= 0 && !mineUnits;
    h += '<button class="' + (mineUnits ? "on" : "") + '" data-a="t" data-i="' + id + '"' + (taken ? " disabled" : "") + '>' + (mineUnits ? tr("mine_on") : taken ? tr("taken") : tr("mine_btn")) + '</button>';
  }
  h += '<button data-a="o" data-i="' + id + '" aria-expanded="' + open + '">' + (open ? tr("close") : q > 1 || v.sh ? tr("split_btn") : tr("share_btn")) + '</button></div></div>';
  // Opciones (solo se pintan con el artículo abierto: tickets largos pesan menos)
  if (!open) return h + "</div>";
  h += '<div class="more">';
  if (v.sh) {
    var inn = v.sharedBy.indexOf(S.me) >= 0;
    h += '<p class="lbl">' + tr("whole_equal") + '</p><div class="slot"><span>' + (v.sharedBy.length ? esc(nameList(v.sharedBy)) : tr("nobody")) + '</span>' +
      '<button class="' + (inn ? "" : "on") + '" data-a="c" data-i="' + id + '">' + (inn ? tr("remove_me") : tr("join_me")) + '</button></div>' +
      '<button data-a="ns" data-i="' + id + '" style="margin-top:6px">' + tr("to_units") + '</button>';
  } else {
    if (q > 1) {
      h += '<p class="lbl">' + tr("just_me") + '</p><div class="row"><div class="qty"><button aria-label="' + tr("rm_unit") + '" data-a="u" data-i="' + id + '" data-d="-1"' + (mineUnits <= 0 ? " disabled" : "") + '>−</button><b aria-live="polite">' + mineUnits + '</b>' +
        '<button aria-label="' + tr("add_unit") + '" data-a="u" data-i="' + id + '" data-d="1"' + (x.r.free <= 0 ? " disabled" : "") + '>+</button></div><small>' + (x.r.free > 0 ? tr("left_unassigned", x.r.free) : tr("all_taken")) + '</small></div>';
    }
    h += '<p class="lbl" style="margin-top:12px">' + (q > 1 ? tr("with_others") : tr("sharing_it")) + '</p>';
    if (!v.slots.length) h += '<p style="margin:0 0 4px"><small>' + (q > 1 ? tr("hint_multi") : tr("hint_single")) + '</small></p>';
    v.slots.forEach(function (ids, k) {
      var inn = ids.indexOf(S.me) >= 0;
      h += '<div class="slot"><span>' + (q > 1 ? tr("one_unit") : "") + esc(nameList(ids)) + '</span><button class="' + (inn ? "" : "on") + '" data-a="sl" data-i="' + id + '" data-s="' + v.slotIds[k] + '">' + (inn ? tr("remove_me") : tr("join_me")) + '</button></div>';
    });
    h += '<button data-a="ns2" data-i="' + id + '" style="margin-top:6px"' + (x.r.free <= 0 ? " disabled" : "") + '>+ ' + (q > 1 ? tr("share_unit").slice(2) : tr("share_with").slice(2)) + '</button>';
  }
  return h + "</div></div>";
}

function renderWho(people) {
  $("items").innerHTML = ""; $("filters").hidden = true; $("mine").hidden = true; $("prog").hidden = true; $("ad").hidden = true;
  var w = $("who"); w.hidden = false;
  w.innerHTML = '<div class="card"><p style="margin-top:0"><b style="color:var(--ink);font-size:1.1rem">' + tr("who_title") + '</b><br>' + tr("who_hint") + '</p>' +
    people.map(function (p) { return '<button class="pick ' + (p.id === S.last ? 'on' : '') + '" data-a="w" data-p="' + p.id + '"><span class="av" aria-hidden="true">' + initial(p.name) + '</span><span>' + esc(p.name) + (p.id === S.last ? '<small>' + tr("last_you") + '</small>' : "") + '</span></button>'; }).join("") +
    '<p style="margin-bottom:0">' + tr("not_listed") + '</p><form id="addform"><input id="newname" maxlength="30" autocomplete="given-name" placeholder="' + tr("name_ph") + '"><button id="addme" class="on" type="submit" style="width:100%">' + tr("add_me") + '</button></form><p id="adderr" class="err" role="alert" style="margin:6px 0 0"></p></div>';
  $("addform").onsubmit = async function (ev) {
    ev.preventDefault();
    var name = $("newname").value.trim(); if (!name) return $("newname").focus();
    var btn = $("addme"); btn.disabled = true; btn.textContent = tr("adding"); $("adderr").textContent = "";
    var id = (BigInt(Math.floor(Math.random() * 2 ** 30)) << 32n | BigInt(crypto.getRandomValues(new Uint32Array(1))[0])).toString();
    try { await listChange("groups/" + S.groupId, "people", [{ mapValue: { fields: { id: int(id), name: { stringValue: name } } } }], true); }
    catch (e) { btn.disabled = false; btn.textContent = tr("add_me"); $("adderr").textContent = tr("add_fail"); return; }
    S.me = id; S.last = id; store("distro.me." + S.groupId, id); refresh(true);
  };
}

document.addEventListener("click", async function (e) {
  if (e.target.closest("#retry")) return location.reload();
  var b = e.target.closest("[data-a], #ok"); if (!b || S.busy) return;
  var a = b.dataset.a, i = b.dataset.i;
  if (a === "chg") {
    e.preventDefault();
    if (pending() && !confirm(tr("discard_q"))) return;
    S.last = S.me; S.me = null; draft = {}; dirty = {}; hasSaved = false; S.open = null; return render();
  }
  if (b.id === "ok") return confirmMine(b);
  if (a === "w") { S.me = b.dataset.p; store("distro.me." + S.groupId, S.me); return render(); }
  if (a === "f") { S.filter = b.dataset.f; return render(); }
  if (a === "o") { if (e.target.closest("button[data-a]:not([data-a=o])")) return; S.open = S.open === i ? null : i; return render(); }
  if (!S.ticket.items.some(function (x) { return x.id === i; })) return;
  if (a === "u") change(i, function (nd, v, it) {
    var others = Object.keys(v.units).reduce(function (n, p) { return n + (p === S.me ? 0 : v.units[p]); }, 0) + v.slots.length;
    nd.u = Math.max(0, Math.min(Number(it.quantity) - others, nd.u + Number(b.dataset.d)));
  });
  else if (a === "t") change(i, function (nd) { nd.u = nd.u ? 0 : 1; });
  else if (a === "c") change(i, function (nd) { nd.inn = !nd.inn; });
  else if (a === "ns") change(i, function (nd) { nd.sh = false; });
  else if (a === "sl") change(i, function (nd) { var k = b.dataset.s, j = nd.sl.indexOf(k); if (j >= 0) nd.sl.splice(j, 1); else nd.sl.push(k); });
  else if (a === "ns2") change(i, function (nd, v, it) {
    var used = Object.keys(v.units).reduce(function (n, p) { return n + v.units[p]; }, 0) + v.slots.length;
    if (used >= Number(it.quantity)) return;
    nd.sl.push(String(Math.floor(Math.random() * 2 ** 50) + 1));
  });
});

// Guarda de una vez lo que ha cambiado el usuario.
async function confirmMine(btn) {
  S.busy = true; btn.disabled = true; btn.textContent = tr("saving"); $("saved").className = ""; $("saved").textContent = "";
  var tp = "groups/" + S.groupId + "/tickets/" + ticketId;
  try {
    for (var id in dirty) {
      var it = S.ticket.items.find(function (x) { return x.id === id; }), now = draft[id], old = server(it);
      if (now.u !== old.u) {
        var f = now.u > 0 ? { claims: mv(kv(id, mv({ units: mv(kv(S.me, int(now.u))) }))) } : {};
        await patch(tp, ["claims." + tick(id) + ".units." + tick(S.me)], f);
      }
      if (now.sh !== old.sh) await patch(tp, ["claims." + tick(id) + ".shared"], { claims: mv(kv(id, mv({ shared: { booleanValue: now.sh } }))) });
      if (now.inn !== old.inn) await listChange(tp, "claims." + tick(id) + ".sharedBy", [int(S.me)], now.inn);
      var ids = now.sl.concat(old.sl.filter(function (k) { return now.sl.indexOf(k) < 0; }));
      for (var n = 0; n < ids.length; n++) {
        var k = ids[n], was = old.sl.indexOf(k) >= 0, is = now.sl.indexOf(k) >= 0;
        if (was !== is) await listChange(tp, "claims." + tick(id) + ".slots." + tick(k), [int(S.me)], is);
      }
    }
    draft = {}; dirty = {}; hasSaved = true;
    S.busy = false; await refresh(true);
    if (navigator.vibrate) navigator.vibrate(30);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) { S.busy = false; $("saved").className = "dirty"; $("saved").textContent = tr("save_fail"); }
  S.busy = false; render();
}

start();
