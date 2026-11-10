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
const S = { user: null, code: clean(params.get("c")), groups: null, gid: null, group: null, expenses: [], tickets: [], tab: "exp", sig: null, busy: false };
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
  no_groups: ["Aún no estás en ningún grupo. Crea uno con «+ Grupo», arriba, o pide a alguien del grupo que te invite (en la app o en la web, con «Invitar») y abre el enlace o escribe aquí el código.", "You're not in any group yet. Create one with “+ Group” at the top, or ask someone in the group to invite you (in the app or on the web, with “Invite”) and open the link or type the code here.", "Encara no ets a cap grup. Crea'n un amb «+ Grup», a dalt, o demana a algú del grup que et convidi (a l'app o al web, amb «Convidar») i obre l'enllaç o escriu aquí el codi."],
  add_grp: ["+ Grupo", "+ Group", "+ Grup"],
  add_grp_lbl: ["Crear un grupo", "Create a group", "Crear un grup"],
  new_grp: ["Nuevo grupo", "New group", "Nou grup"],
  grp_name: ["Nombre del grupo", "Group name", "Nom del grup"],
  grp_name_ph: ["Viaje a Lisboa, piso, cenas…", "Lisbon trip, flat, dinners…", "Viatge a Lisboa, pis, sopars…"],
  your_name: ["Tu nombre", "Your name", "El teu nom"],
  others: ["Las demás personas", "The other people", "Les altres persones"],
  others_hint: ["Escribe un nombre y pulsa «Añadir». Luego, con «Invitar», les mandas un enlace para que entren y elijan quiénes son.", "Type a name and press “Add”. Then use “Invite” to send them a link to join and pick who they are.", "Escriu un nom i prem «Afegir». Després, amb «Convidar», els envies un enllaç perquè hi entrin i triïn qui són."],
  invite: ["Invitar", "Invite", "Convidar"],
  invite_to: ["Invitar a «{0}»", "Invite to “{0}”", "Convidar a «{0}»"],
  invite_body: ["Mándales el enlace: con la app de Android se abre Distro y, si no, entran desde el navegador. También pueden escribir el código en «Unirse con un código».", "Send them the link: with the Android app it opens Distro, otherwise they join from the browser. They can also type the code in “Join with a code”.", "Envia'ls l'enllaç: amb l'app d'Android s'obre Distro i, si no, hi entren des del navegador. També poden escriure el codi a «Unir-se amb un codi»."],
  inviting: ["Creando la invitación…", "Creating the invite…", "Creant la invitació…"],
  expires_7: ["Caduca en 7 días.", "Expires in 7 days.", "Caduca d'aquí a 7 dies."],
  invite_share_text: ["Únete a «{0}» en Distro: {1}\nO escribe el código {2} en la app o en montarc.es/g.", "Join “{0}” on Distro: {1}\nOr enter the code {2} in the app or at montarc.es/g.", "Uneix-te a «{0}» a Distro: {1}\nO escriu el codi {2} a l'app o a montarc.es/g."],
  share: ["Compartir", "Share", "Compartir"],
  copy_link: ["Copiar enlace", "Copy link", "Copiar l'enllaç"],
  copied: ["Enlace copiado.", "Link copied.", "Enllaç copiat."],
  close: ["Cerrar", "Close", "Tancar"],
  e_invite: ["No se ha podido crear la invitación. ¿Tienes conexión?", "Couldn't create the invite. Are you online?", "No s'ha pogut crear la invitació. Tens connexió?"],
  other_ph: ["Nombre", "Name", "Nom"],
  add_person: ["Añadir", "Add", "Afegir"],
  remove_person: ["Quitar a {0}", "Remove {0}", "Treure {0}"],
  currency: ["Moneda", "Currency", "Moneda"],
  create: ["Crear grupo", "Create group", "Crear el grup"],
  e_grp_name: ["Escribe un nombre para el grupo.", "Type a name for the group.", "Escriu un nom per al grup."],
  e_your_name: ["Escribe tu nombre.", "Type your name.", "Escriu el teu nom."],
  e_dup: ["Ya hay alguien con ese nombre.", "Someone already has that name.", "Ja hi ha algú amb aquest nom."],
  e_create: ["No se ha podido crear el grupo. Inténtalo de nuevo.", "Couldn't create the group. Please try again.", "No s'ha pogut crear el grup. Torna-ho a provar."],
  created: ["Grupo creado.", "Group created.", "Grup creat."],
  join_title: ["Unirse con un código", "Join with a code", "Unir-se amb un codi"],
  join_btn: ["Unirse", "Join", "Unir-se"],
  joining: ["Entrando en el grupo…", "Joining the group…", "Entrant al grup…"],
  join_q: ["Te han invitado a un grupo de Distro. ¿Entrar en él con esta cuenta ({0})?", "You've been invited to a Distro group. Join it with this account ({0})?", "T'han convidat a un grup de Distro. Vols entrar-hi amb aquest compte ({0})?"],
  e_code: ["El código no existe o ha caducado. Pide uno nuevo.", "That code doesn't exist or has expired. Ask for a new one.", "El codi no existeix o ha caducat. Demana'n un de nou."],
  e_join: ["No se ha podido entrar en el grupo.", "Couldn't join the group.", "No s'ha pogut entrar al grup."],
  inst_h: ["Ponla en tu pantalla de inicio", "Add it to your home screen", "Posa-la a la pantalla d'inici"],
  inst_p: ["Se abre como una app, a pantalla completa y sin buscarla en el navegador.", "It opens like an app, full screen, without looking for it in the browser.", "S'obre com una app, a pantalla completa i sense buscar-la al navegador."],
  inst_ios: ["Toca <b>Compartir</b> <span aria-hidden=\"true\">(□↑)</span> en la barra del navegador y elige <b>«Añadir a pantalla de inicio»</b>. Si no la ves, desliza la lista hacia abajo.", "Tap <b>Share</b> <span aria-hidden=\"true\">(□↑)</span> in the browser bar and choose <b>“Add to Home Screen”</b>. If you can't see it, scroll the list down.", "Toca <b>Compartir</b> <span aria-hidden=\"true\">(□↑)</span> a la barra del navegador i tria <b>«Afegir a la pantalla d'inici»</b>. Si no el veus, llisca la llista cap avall."],
  inst_samsung: ["Abre el menú <b>☰</b> de abajo, toca <b>«Añadir página a»</b> y elige <b>«Pantalla de inicio»</b>.", "Open the <b>☰</b> menu at the bottom, tap <b>“Add page to”</b> and choose <b>“Home screen”</b>.", "Obre el menú <b>☰</b> de baix, toca <b>«Afegir pàgina a»</b> i tria <b>«Pantalla d'inici»</b>."],
  inst_android: ["Abre el menú <b>⋮</b> del navegador y toca <b>«Añadir a pantalla de inicio»</b> o <b>«Instalar aplicación»</b>.", "Open the browser's <b>⋮</b> menu and tap <b>“Add to Home screen”</b> or <b>“Install app”</b>.", "Obre el menú <b>⋮</b> del navegador i toca <b>«Afegir a la pantalla d'inici»</b> o <b>«Instal·lar l'aplicació»</b>."],
  install: ["Añadir a la pantalla de inicio", "Add to home screen", "Afegir a la pantalla d'inici"],
  inst_hide: ["No mostrar más", "Don't show again", "No mostrar més"],
  get_app: ["¿Tienes Android? Descarga Distro en Google Play para escanear tickets.", "On Android? Get Distro on Google Play to scan receipts.", "Tens Android? Descarrega Distro a Google Play per escanejar tiquets."],
  back: ["← Tus grupos", "← Your groups", "← Els teus grups"],
  back_lbl: ["Volver a tus grupos", "Back to your groups", "Tornar als teus grups"],
  sections: ["Secciones del grupo", "Group sections", "Seccions del grup"],
  tab_exp: ["Gastos", "Expenses", "Despeses"],
  tab_bal: ["Saldos", "Balances", "Saldos"],
  spent: ["{0} gastados", "{0} spent", "{0} gastats"],
  no_exp: ["Todavía no hay gastos. Añade el primero con «+ Gasto», arriba.", "No expenses yet. Add the first one with “+ Expense” at the top.", "Encara no hi ha despeses. Afegeix la primera amb «+ Despesa», a dalt."],
  exp_1: ["1 gasto", "1 expense", "1 despesa"],
  exp_n: ["{0} gastos", "{0} expenses", "{0} despeses"],
  col_date: ["Fecha", "Date", "Data"],
  col_what: ["Concepto", "Description", "Concepte"],
  col_amount: ["Importe", "Amount", "Import"],
  col_person: ["Persona", "Person", "Persona"],
  col_paid: ["Pagó", "Paid", "Va pagar"],
  col_share: ["Le toca", "Share", "Li toca"],
  col_bal: ["Saldo", "Balance", "Saldo"],
  bal_foot: ["Saldo = lo que pagó − lo que le toca. Positivo: le deben; negativo: debe.", "Balance = paid − share. Positive: they're owed; negative: they owe.", "Saldo = el que va pagar − el que li toca. Positiu: li deuen; negatiu: deu."],
  bal_foot_x: ["El saldo ya descuenta los pagos entre vosotros.", "The balance already includes payments between you.", "El saldo ja descompta els pagaments entre vosaltres."],
  pays_to: ["paga a", "pays", "paga a"],
  paid_short: ["Pagado", "Paid", "Pagat"],
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
  add_exp: ["+ Gasto", "+ Expense", "+ Despesa"],
  add_exp_lbl: ["Añadir gasto", "Add expense", "Afegir despesa"],
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
  scan_btn: ["📷 Leer un ticket", "📷 Scan a receipt", "📷 Llegir un tiquet"],
  scan_h: ["Leer un ticket", "Scan a receipt", "Llegir un tiquet"],
  scan_p: ["Haz una foto del ticket recto y con luz, o elige una de la galería. Si es muy largo, usa varias fotos de arriba abajo (hasta 5). La foto se lee en tu móvil y no se sube a ningún sitio.", "Take a straight, well-lit photo of the receipt or pick one from your gallery. If it's very long, use several photos from top to bottom (up to 5). The photo is read on your phone and isn't uploaded anywhere.", "Fes una foto del tiquet recta i amb llum, o tria'n una de la galeria. Si és molt llarg, fes servir diverses fotos de dalt a baix (fins a 5). La foto es llegeix al teu mòbil i no es puja enlloc."],
  scan_first: ["La primera vez se descargan unos 6 MB para poder leerlo; luego ya no.", "The first time, about 6 MB are downloaded to read it; after that, not again.", "La primera vegada es descarreguen uns 6 MB per poder-lo llegir; després ja no."],
  add_photo: ["+ Foto", "+ Photo", "+ Foto"],
  photo_n: ["Foto {0}", "Photo {0}", "Foto {0}"],
  rm_photo: ["Quitar la foto {0}", "Remove photo {0}", "Treure la foto {0}"],
  read_btn: ["Leer ticket", "Read receipt", "Llegir el tiquet"],
  ocr_load: ["Preparando el lector… {0}", "Getting the reader ready… {0}", "Preparant el lector… {0}"],
  ocr_read: ["Leyendo la foto {0} de {1}… {2}", "Reading photo {0} of {1}… {2}", "Llegint la foto {0} de {1}… {2}"],
  e_ocr: ["No se ha podido leer el ticket. Inténtalo de nuevo o apúntalo a mano con «+ Gasto».", "Couldn't read the receipt. Try again or add it by hand with “+ Expense”.", "No s'ha pogut llegir el tiquet. Torna-ho a provar o apunta'l a mà amb «+ Despesa»."],
  review_h: ["Revisa el ticket", "Check the receipt", "Revisa el tiquet"],
  review_p: ["Corrige lo que se haya leído mal y compara el total con el del papel.", "Fix anything read wrong and compare the total with the paper.", "Corregeix el que s'hagi llegit malament i compara el total amb el del paper."],
  none_read: ["No se ha leído ningún artículo. Prueba con otra foto más de cerca, recta y con luz, o añádelos a mano.", "No items were read. Try another photo, closer, straight and well lit, or add them by hand.", "No s'ha llegit cap article. Prova amb una altra foto més a prop, recta i amb llum, o afegeix-los a mà."],
  items_h: ["Artículos", "Items", "Articles"],
  item_name: ["Artículo {0}", "Item {0}", "Article {0}"],
  item_qty: ["Unidades del artículo {0}", "Units of item {0}", "Unitats de l'article {0}"],
  item_amt: ["Importe del artículo {0}", "Amount of item {0}", "Import de l'article {0}"],
  rm_item: ["Quitar el artículo {0}", "Remove item {0}", "Treure l'article {0}"],
  add_item: ["+ Añadir artículo", "+ Add item", "+ Afegir article"],
  sum_is: ["Suma: {0}", "Sum: {0}", "Suma: {0}"],
  sum_off: ["El ticket dice {0} y la suma da {1}: revisa los importes.", "The receipt says {0} but the items add up to {1}: check the amounts.", "El tiquet diu {0} i la suma dona {1}: revisa els imports."],
  sum_ok: ["Cuadra con el total del ticket.", "Matches the receipt total.", "Quadra amb el total del tiquet."],
  e_items: ["Revisa los artículos: cada uno necesita nombre, unidades (1 o más) e importe.", "Check the items: each needs a name, units (1 or more) and an amount.", "Revisa els articles: cadascun necessita nom, unitats (1 o més) i import."],
  e_noitems: ["Añade al menos un artículo.", "Add at least one item.", "Afegeix almenys un article."],
  upload: ["Subir para que cada uno marque lo suyo", "Upload so everyone marks their own", "Pujar perquè cadascú marqui el seu"],
  as_equal: ["Apuntar a partes iguales", "Add as an equal split", "Apuntar a parts iguals"],
  ticket_def: ["Ticket", "Receipt", "Tiquet"],
  uploaded_h: ["Ticket subido", "Receipt uploaded", "Tiquet pujat"],
  uploaded_p: ["Ahora cada uno marca lo suyo con el enlace (o en la app). Cuando estéis, ciérralo aquí y se apunta como gasto.", "Now everyone marks their own with the link (or in the app). When you're done, close it here and it's saved as an expense.", "Ara cadascú marca el seu amb l'enllaç (o a l'app). Quan estigueu, tanca'l aquí i s'apunta com a despesa."],
  pend_h: ["Tickets pendientes", "Pending receipts", "Tiquets pendents"],
  pend_meta: ["Pagó {0} · {1}", "Paid by {0} · {1}", "Va pagar {0} · {1}"],
  pend_missing: ["Falta por marcar: {0}", "Not marked yet: {0}", "Falta per marcar: {0}"],
  pend_all: ["Ya ha marcado todo el mundo.", "Everyone has marked.", "Ja ho ha marcat tothom."],
  mark_mine: ["Marcar lo mío", "Mark mine", "Marcar el meu"],
  send_link: ["Enviar enlace", "Send link", "Enviar l'enllaç"],
  close_ticket: ["Cerrar ticket", "Close receipt", "Tancar el tiquet"],
  delete_ticket: ["Borrar", "Delete", "Esborrar"],
  confirm_close: ["Se apuntará como un gasto de {0} con lo que ha marcado cada uno. Lo que nadie ha marcado ({1}) se reparte entre todos. ¿Cerrarlo?", "It will be saved as a {0} expense with what each person marked. Anything nobody marked ({1}) is split between everyone. Close it?", "S'apuntarà com una despesa de {0} amb el que ha marcat cadascú. El que ningú ha marcat ({1}) es reparteix entre tothom. Tancar-lo?"],
  confirm_close_all: ["Se apuntará como un gasto de {0} con lo que ha marcado cada uno. ¿Cerrarlo?", "It will be saved as a {0} expense with what each person marked. Close it?", "S'apuntarà com una despesa de {0} amb el que ha marcat cadascú. Tancar-lo?"],
  confirm_del_ticket: ["¿Borrar el ticket «{0}»? Se perderá lo que haya marcado cada uno.", "Delete the receipt “{0}”? What everyone marked will be lost.", "Esborrar el tiquet «{0}»? Es perdrà el que hagi marcat cadascú."],
  closed_ok: ["Ticket cerrado y apuntado como gasto.", "Receipt closed and saved as an expense.", "Tiquet tancat i apuntat com a despesa."],
  ticket_share_text: ["Marca lo tuyo del ticket «{0}» en Distro: {1}", "Mark your items on the receipt “{0}” on Distro: {1}", "Marca el teu del tiquet «{0}» a Distro: {1}"],
  ticket_link_h: ["Enlace del ticket «{0}»", "Link for “{0}”", "Enllaç del tiquet «{0}»"],
  ticket_link_p: ["Quien lo abra marca lo suyo sin tener que entrar en el grupo ni ver los gastos.", "Whoever opens it marks their own without joining the group or seeing the expenses.", "Qui l'obri marca el seu sense haver d'entrar al grup ni veure les despeses."],
  tab_stats: ["Estadísticas", "Stats", "Estadístiques"],
  more: ["Más opciones del grupo", "More group options", "Més opcions del grup"],
  edit_exp: ["Editar gasto", "Edit expense", "Editar despesa"],
  amount_lbl: ["Importe", "Amount", "Import"],
  total_lbl: ["Importe (la suma de abajo)", "Amount (the sum below)", "Import (la suma de sota)"],
  paid_in: ["Moneda en la que se pagó", "Currency it was paid in", "Moneda en què es va pagar"],
  m_label: ["Cómo se reparte", "How to split it", "Com es reparteix"],
  m_equal: ["A partes iguales", "Equally", "A parts iguals"],
  m_parts: ["Por partes", "By shares", "Per parts"],
  m_amounts: ["Por importes", "By amounts", "Per imports"],
  m_pct: ["Por porcentajes", "By percentage", "Per percentatges"],
  parts_hint: ["Cuántas partes le tocan a cada uno: 2× paga el doble que 1×; 0× no paga.", "How many shares each person pays: 2× pays twice as much as 1×; 0× pays nothing.", "Quantes parts li toquen a cadascú: 2× paga el doble que 1×; 0× no paga."],
  less_for: ["Una parte menos para {0}", "One share less for {0}", "Una part menys per a {0}"],
  more_for: ["Una parte más para {0}", "One share more for {0}", "Una part més per a {0}"],
  amount_of: ["Importe de {0}", "Amount for {0}", "Import de {0}"],
  pct_of: ["Porcentaje de {0}", "Percentage for {0}", "Percentatge de {0}"],
  total_is: ["Total: {0}", "Total: {0}", "Total: {0}"],
  pct_ok: ["Suman 100 %.", "They add up to 100%.", "Sumen 100 %."],
  pct_sum: ["Suman {0} %: tiene que ser 100 %.", "They add up to {0}%: it must be 100%.", "Sumen {0} %: ha de ser 100 %."],
  e_amounts: ["Revisa los importes: números como 12,50.", "Check the amounts: numbers like 12.50.", "Revisa els imports: números com 12,50."],
  e_pct: ["Los porcentajes tienen que sumar 100 % (números como 33,33).", "The percentages must add up to 100% (numbers like 33.33).", "Els percentatges han de sumar 100 % (números com 33,33)."],
  rate_lbl: ["Tipo de cambio: 1 {0} = ? {1}", "Exchange rate: 1 {0} = ? {1}", "Tipus de canvi: 1 {0} = ? {1}"],
  rate_loading: ["Buscando el tipo de hoy…", "Looking up today's rate…", "Buscant el tipus d'avui…"],
  rate_auto: ["Tipo de hoy, puesto automáticamente. Puedes cambiarlo.", "Today's rate, filled in automatically. You can change it.", "Tipus d'avui, posat automàticament. El pots canviar."],
  rate_failed: ["No se ha podido obtener el tipo de hoy. Escríbelo a mano.", "Couldn't get today's rate. Type it in.", "No s'ha pogut obtenir el tipus d'avui. Escriu-lo a mà."],
  rate_preview: ["Equivale a {0}", "Equals {0}", "Equival a {0}"],
  e_rate: ["Escribe el tipo de cambio (por ejemplo, 0,92).", "Type the exchange rate (for example, 0.92).", "Escriu el tipus de canvi (per exemple, 0,92)."],
  paid_orig: ["Pagado {0} · 1 {1} = {2} {3}", "Paid {0} · 1 {1} = {2} {3}", "Pagat {0} · 1 {1} = {2} {3}"],
  repeat: ["Repetir cada mes", "Repeat every month", "Repetir cada mes"],
  repeat_hint: ["Alquiler, recibos, suscripciones: se apunta solo el mismo día de cada mes.", "Rent, bills, subscriptions: added automatically on the same day every month.", "Lloguer, rebuts, subscripcions: s'apunta sol el mateix dia de cada mes."],
  delete_exp: ["Borrar", "Delete", "Esborrar"],
  confirm_del_exp: ["¿Borrar «{0}»?", "Delete “{0}”?", "Esborrar «{0}»?"],
  confirm_del_pay: ["¿Borrar este pago de {0}?", "Delete this {0} payment?", "Esborrar aquest pagament de {0}?"],
  exp_deleted: ["Gasto borrado.", "Expense deleted.", "Despesa esborrada."],
  pay_deleted: ["Pago borrado.", "Payment deleted.", "Pagament esborrat."],
  undo: ["Deshacer", "Undo", "Desfer"],
  restored: ["Recuperado.", "Restored.", "Recuperat."],
  edited: ["Gasto cambiado.", "Expense updated.", "Despesa canviada."],
  open_exp: ["{0}, {1}: ver o editar", "{0}, {1}: view or edit", "{0}, {1}: veure o editar"],
  open_pay: ["Pago de {0} a {1}, {2}: borrar", "Payment from {0} to {1}, {2}: delete", "Pagament de {0} a {1}, {2}: esborrar"],
  no_stats: ["Aún no hay estadísticas. Cuando apuntéis gastos, aquí verás quién gasta más, los días fuertes y en qué se va el dinero.", "No stats yet. Once you add expenses, you'll see who spends most, the big days and where the money goes.", "Encara no hi ha estadístiques. Quan apunteu despeses, aquí veureu qui gasta més, els dies forts i en què se'n van els diners."],
  st_total: ["Gasto total", "Total spent", "Despesa total"],
  st_count: ["Gastos", "Expenses", "Despeses"],
  st_avg: ["Media por gasto", "Average per expense", "Mitjana per despesa"],
  st_pp: ["Por persona", "Per person", "Per persona"],
  st_pd: ["Por día ({0} días)", "Per day ({0} days)", "Per dia ({0} dies)"],
  st_people: ["Gasto por persona", "Spending per person", "Despesa per persona"],
  st_paid_share: ["Pagó {0} · le tocaba {1}", "Paid {0} · share {1}", "Va pagar {0} · li tocava {1}"],
  st_cats: ["En qué se va el dinero", "Where the money goes", "En què se'n van els diners"],
  st_daily: ["Gasto por día", "Spending per day", "Despesa per dia"],
  st_days: ["Los días con más gasto", "The biggest spending days", "Els dies amb més despesa"],
  st_big: ["El gasto más grande", "The biggest expense", "La despesa més gran"],
  cat_food: ["Comer", "Food", "Menjar"], cat_drinks: ["Bebidas", "Drinks", "Begudes"], cat_groceries: ["Compra", "Groceries", "Compra"],
  cat_transport: ["Transporte", "Transport", "Transport"], cat_lodging: ["Alojamiento y casa", "Lodging and home", "Allotjament i casa"],
  cat_leisure: ["Ocio", "Leisure", "Oci"], cat_bills: ["Facturas", "Bills", "Factures"], cat_gifts: ["Regalos", "Gifts", "Regals"],
  cat_health: ["Salud", "Health", "Salut"], cat_trips: ["Viajes y eventos", "Trips and events", "Viatges i esdeveniments"], cat_other: ["Otros", "Other", "Altres"],
  menu_h: ["Opciones del grupo", "Group options", "Opcions del grup"],
  m_edit: ["Nombre, icono y moneda", "Name, icon and currency", "Nom, icona i moneda"],
  m_people: ["Participantes", "People", "Participants"],
  m_recurring: ["Gastos de cada mes", "Monthly expenses", "Despeses de cada mes"],
  m_activity: ["Actividad", "Activity", "Activitat"],
  m_csv: ["Exportar a CSV", "Export to CSV", "Exportar a CSV"],
  m_share_bal: ["Compartir saldos", "Share balances", "Compartir saldos"],
  m_leave: ["Salir del grupo", "Leave the group", "Sortir del grup"],
  m_delete: ["Borrar el grupo", "Delete the group", "Esborrar el grup"],
  g_icon: ["Icono (un emoji)", "Icon (an emoji)", "Icona (un emoji)"],
  g_icon_hint: ["Vacío = automático (la inicial del nombre).", "Empty = automatic (the name's initial).", "Buit = automàtic (la inicial del nom)."],
  g_cur_hint: ["Los gastos nuevos usan esta moneda. Los importes que ya hay no se convierten.", "New expenses use this currency. Existing amounts aren't converted.", "Les despeses noves fan servir aquesta moneda. Els imports que ja hi ha no es converteixen."],
  g_saved: ["Grupo guardado.", "Group saved.", "Grup desat."],
  p_me: ["Soy yo", "That's me", "Sóc jo"],
  p_remove: ["Quitar", "Remove", "Treure"],
  p_involved: ["Tiene gastos: no se puede quitar.", "Has expenses: can't be removed.", "Té despeses: no es pot treure."],
  p_add: ["Nombre de la persona nueva", "New person's name", "Nom de la persona nova"],
  confirm_rm_person: ["¿Quitar a {0} del grupo?", "Remove {0} from the group?", "Treure {0} del grup?"],
  rec_hint: ["Se apuntan solos cada mes, el mismo día, cuando alguien abre la app o la web.", "They're added automatically every month, on the same day, when someone opens the app or the web.", "S'apunten sols cada mes, el mateix dia, quan algú obre l'app o el web."],
  rec_none: ["No hay gastos que se repitan. Al apuntar un gasto, marca «Repetir cada mes».", "No repeating expenses. When you add an expense, tick “Repeat every month”.", "No hi ha despeses que es repeteixin. En apuntar una despesa, marca «Repetir cada mes»."],
  rec_line: ["Paga {0} · día {1} de cada mes", "Paid by {0} · day {1} of every month", "Paga {0} · dia {1} de cada mes"],
  rec_stop: ["Dejar de repetir", "Stop repeating", "Deixar de repetir"],
  rec_stop_q: ["¿Dejar de repetir «{0}»? Los meses ya apuntados se quedan como gastos normales.", "Stop repeating “{0}”? Months already added stay as normal expenses.", "Deixar de repetir «{0}»? Els mesos ja apuntats es queden com a despeses normals."],
  loading: ["Cargando…", "Loading…", "Carregant…"],
  someone: ["Alguien", "Someone", "Algú"],
  act_empty: ["Aún no hay nada. Aquí verás los cambios que hagan los miembros del grupo.", "Nothing yet. Here you'll see the changes group members make.", "Encara no hi ha res. Aquí veuràs els canvis que facin els membres del grup."],
  act_expense_added: ["{0} añadió «{1}» ({2})", "{0} added “{1}” ({2})", "{0} va afegir «{1}» ({2})"],
  act_expense_edited: ["{0} editó «{1}» ({2})", "{0} edited “{1}” ({2})", "{0} va editar «{1}» ({2})"],
  act_expense_deleted: ["{0} borró «{1}» ({2})", "{0} deleted “{1}” ({2})", "{0} va esborrar «{1}» ({2})"],
  act_refund: ["{0} apuntó un reembolso de {1}", "{0} recorded a refund of {1}", "{0} va apuntar un reemborsament de {1}"],
  act_ticket_uploaded: ["{0} subió el ticket «{1}» ({2})", "{0} uploaded the receipt “{1}” ({2})", "{0} va pujar el tiquet «{1}» ({2})"],
  act_ticket_closed: ["{0} cerró el ticket «{1}» ({2})", "{0} closed the receipt “{1}” ({2})", "{0} va tancar el tiquet «{1}» ({2})"],
  act_person_added: ["{0} añadió a {1} al grupo", "{0} added {1} to the group", "{0} va afegir {1} al grup"],
  act_person_removed: ["{0} quitó a {1} del grupo", "{0} removed {1} from the group", "{0} va treure {1} del grup"],
  act_person_renamed: ["{0} cambió un nombre: {1}", "{0} changed a name: {1}", "{0} va canviar un nom: {1}"],
  csv_type: ["Tipo", "Type", "Tipus"],
  csv_orig: ["Original", "Original", "Original"],
  bal_text_title: ["💶 {0} — gasto total {1}", "💶 {0} — total spent {1}", "💶 {0} — despesa total {1}"],
  to_settle: ["Para saldar:", "To settle up:", "Per liquidar:"],
  settle_line: ["• {0} paga {1} a {2}", "• {0} pays {2} {1}", "• {0} paga {1} a {2}"],
  bal_copied: ["Saldos copiados: pégalos donde quieras.", "Balances copied: paste them anywhere.", "Saldos copiats: enganxa'ls on vulguis."],
  leave_q: ["¿Salir de «{0}»? Dejarás de verlo; los demás lo siguen teniendo con todos los gastos.", "Leave “{0}”? You'll stop seeing it; the others keep it with all the expenses.", "Sortir de «{0}»? Deixaràs de veure'l; els altres el continuen tenint amb totes les despeses."],
  leave_alone_q: ["¿Salir de «{0}»? Nadie más tiene este grupo, así que se borrará con sus gastos.", "Leave “{0}”? Nobody else has this group, so it will be deleted with its expenses.", "Sortir de «{0}»? Ningú més té aquest grup, així que s'esborrarà amb les despeses."],
  delete_q: ["¿Borrar «{0}» para todos? Se borrarán todos sus gastos. No se puede deshacer.", "Delete “{0}” for everyone? All its expenses will be deleted. This can't be undone.", "Esborrar «{0}» per a tothom? S'esborraran totes les despeses. No es pot desfer."],
  left_ok: ["Has salido del grupo.", "You left the group.", "Has sortit del grup."],
  deleted_g: ["Grupo borrado.", "Group deleted.", "Grup esborrat."],
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
// Para texto y para valores de atributos: también las comillas (sin ellas, un «"» cerraba el atributo).
function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
// Los ids (grupos, personas, gastos, tickets, artículos) son enteros como en la app. Lo que no lo sea
// se descarta al leer: las reglas dejan escribir algunos de estos datos a invitados y no los validan.
const isId = (x) => typeof x === "string" && /^\d{1,19}$/.test(x);
// Fechas de fiar (de 2000 a 2100, como en las reglas y en SaneTime de la app): con una disparatada, los
// meses de un gasto fijo o los días de las estadísticas eran millones de vueltas (pentest 2026-11-10, D2).
const T_MIN = 946684800000, T_MAX = 4102444799999;
const saneTime = (ms) => Math.min(T_MAX, Math.max(T_MIN, Number(ms) || 0));
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
// Aviso flotante abajo (como el de la app): se ve aunque se haya bajado por la lista.
function flash(msg, undo) {
  status(esc(msg)); clearTimeout(flashTimer);
  $("status").classList.add("toast");
  if (undo) {
    const b = document.createElement("button"); b.type = "button"; b.className = "link"; b.textContent = tr("undo");
    b.onclick = () => { clearTimeout(flashTimer); status(""); undo(); };
    $("status").appendChild(document.createTextNode(" ")); $("status").appendChild(b);
  }
  flashTimer = setTimeout(() => status(""), undo ? 9000 : 4000);
}
function header(h1, sub) { $("h1").textContent = h1; $("sub").textContent = sub || ""; document.title = h1 ? h1 + " · Distro" : "Distro"; }
// Cabecera dentro de un grupo (atrás, «+ Gasto» y pestañas) o fuera (logo). Las pestañas son enlaces:
// la dirección dice cuál está abierta, y «atrás» y compartir el enlace funcionan.
function inGroup(gid) {
  $("back").hidden = !gid; $("logo").hidden = !!gid; $("add").hidden = !gid; $("tabs").hidden = !gid;
  if (!gid) return;
  const add = $("add"); // si no, mientras carga el grupo seguiría siendo «+ Grupo»
  add.textContent = tr("add_exp"); add.setAttribute("aria-label", tr("add_exp_lbl")); add.onclick = () => { if (S.group) openAddExpense(); };
  $("tabs").innerHTML = [["exp", "gastos", "tab_exp"], ["bal", "saldos", "tab_bal"], ["stats", "estadisticas", "tab_stats"]].map(([t, slug, k]) =>
    '<a href="#/g/' + gid + "/" + slug + '"' + (S.tab === t ? ' aria-current="page"' : "") + ">" + tr(k) + "</a>").join("") +
    '<button type="button" class="inv" id="inv" aria-label="' + tr("more") + '" title="' + tr("more") + '"><span aria-hidden="true">⋯</span></button>';
  $("inv").onclick = () => { if (S.group) openMenu(); };
}

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
  return (await r.json()).filter((x) => x.document).map((x) => toGroup(idOf(x.document), decDoc(x.document))).filter((g) => isId(g.id));
}

function toGroup(id, d) {
  const who = d.who || {};
  return {
    id, name: d.name || "", icon: d.icon || null,
    currency: /^[A-Z]{3}$/.test(d.currency || "") ? d.currency : "EUR",
    people: (Array.isArray(d.people) ? d.people : []).filter((p) => p && isId(p.id)).map((p) => ({ id: p.id, name: typeof p.name === "string" && p.name ? p.name : "?" })),
    members: (d.memberUids || []).length,
    me: isId(who[S.user.uid]) ? who[S.user.uid] : null,
    taken: Object.keys(who).filter((u) => u !== S.user.uid && isId(who[u])).map((u) => who[u]),
    createdAt: Number(d.createdAt || 0),
    recurring: Object.keys(d.recurring && typeof d.recurring === "object" ? d.recurring : {}).filter(isId).map((k) => {
      const r = d.recurring[k] || {}, sh = {};
      if (!isId(r.payerId) || r.amountCents == null || !(Number(r.startAt) >= T_MIN && Number(r.startAt) <= T_MAX)) return null;
      Object.keys(r.shares || {}).filter(isId).forEach((pid) => { sh[pid] = Number(r.shares[pid]) || 0; });
      return { id: k, title: typeof r.title === "string" ? r.title : "", payerId: r.payerId, amountCents: Number(r.amountCents), shares: sh, startAt: Number(r.startAt), applied: Math.max(1, Number(r.applied) || 1) };
    }).filter(Boolean).sort((a, b) => a.startAt - b.startAt),
  };
}
function toExpense(id, d) {
  // Los gastos borrados se quedan marcados (borrado suave de la app) y no cuentan. El id del documento lo
  // elige quien lo crea y acaba en atributos (data-exp): uno con comillas ejecutaba código en la web de
  // los demás miembros (pentest 2026-11-10, N1).
  if (!isId(id) || d.deleted === true || !isId(d.payerId) || d.amountCents == null) return null;
  const shares = {};
  Object.keys(d.shares || {}).filter(isId).forEach((k) => { shares[k] = Number(d.shares[k]) || 0; });
  const rate = Number(d.rate), foreign = typeof d.currency === "string" && /^[A-Z]{3}$/.test(d.currency) && d.originalCents != null && rate > 0;
  return { id, title: d.title || "", payerId: String(d.payerId), amountCents: Number(d.amountCents), shares, createdAt: saneTime(d.createdAt), isTransfer: !!d.isTransfer,
    currency: foreign ? d.currency : null, originalCents: foreign ? Number(d.originalCents) : null, rate: foreign ? rate : null };
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
  $("acct").hidden = true; $("skel").hidden = true; inGroup(null);
  header(tr("login_h1"), S.code ? tr("login_join") : tr("login_sub"));
  $("view").innerHTML =
    '<div class="card"><p style="margin-top:0">' + tr("login_text") + "</p>" +
    '<button class="btn google" id="google" type="button">' + GOOGLE_SVG + tr("google") + "</button>" +
    '<p class="or"><label for="mail" style="display:inline;font-weight:400;margin:0">' + tr("or_email") + "</label></p>" +
    '<form id="mailf"><input type="email" id="mail" name="email" required autocomplete="email" inputmode="email" spellcheck="false" autocapitalize="off" placeholder="' + tr("email_ph") + '">' +
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
    $("skel").hidden = true; inGroup(null);
    header(tr("login_h1"), tr("login_sub"));
    $("view").innerHTML = '<form class="card" id="again"><p style="margin-top:0"><label for="mail2" style="font-weight:400;margin:0">' + tr("email_again") + "</label></p>" +
      '<input type="email" id="mail2" name="email" required autocomplete="email" inputmode="email" spellcheck="false" autocapitalize="off" placeholder="' + tr("email_ph") + '">' +
      '<button class="btn on" type="submit">' + tr("finish") + "</button></form>";
    $("again").onsubmit = async (ev) => { ev.preventDefault(); if (await tryWith($("mail2").value.trim())) resolve(); };
  });
}

// --- Menú de la cuenta ---
function setupAccount() {
  const u = S.user, btn = $("acct"), menu = $("menu");
  btn.hidden = false;
  btn.textContent = (u.displayName || u.email || "?").trim().charAt(0).toUpperCase();
  btn.setAttribute("aria-label", tr("account"));
  btn.title = tr("account");
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
      if (g.members <= 1) await deleteGroupDocs(g.id);
      else {
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
  if (!inv || !isId(inv.groupId)) { status(esc(tr("e_code")), "bad"); return null; }
  const uid = S.user.uid, gid = inv.groupId, add = [{ fieldPath: "memberUids", appendMissingElements: { values: [str(uid)] } }];
  try {
    // El código va en una prueba que nadie puede leer (groups/{id}/joins/{uid}), en la misma escritura:
    // antes iba en el grupo y un invitado podía copiarlo para hacerse miembro (pentest 2026-11-04, E1).
    await commit([
      { update: { name: docName("groups/" + gid + "/joins/" + uid), fields: { code: str(code) } } },
      { transform: { document: docName("groups/" + gid), fieldTransforms: add }, currentDocument: { exists: true } },
    ]);
  } catch (e) {
    try {
      // Reglas aún sin la prueba: el camino antiguo, con el código en joins.{uid}.
      await commit([{ update: { name: docName("groups/" + gid), fields: { joins: mv({ [uid]: str(code) }) } },
        updateMask: { fieldPaths: ["joins." + tick(uid)] }, updateTransforms: add, currentDocument: { exists: true } }]);
    } catch (e2) {
      // Si ya eras miembro, las reglas no dejan «volver a entrar», pero el grupo se puede abrir.
      if (!(await getDoc("groups/" + gid))) throw e2;
    }
  }
  status("");
  return gid;
}

// --- Pantallas ---
let pollTimer = null;
function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

// Abre un grupo; si la dirección ya era esa no hay hashchange y se abre a mano.
function go(gid) { const h = "#/g/" + gid; if (location.hash === h) route(); else location.hash = h; }

async function route() {
  $("menu").hidden = true; closeSheet();
  const m = location.hash.match(/^#\/g\/(\d+)(?:\/(gastos|saldos|estadisticas))?/);
  if (m) return openGroup(m[1], m[2] === "saldos" ? "bal" : m[2] === "estadisticas" ? "stats" : "exp");
  return home();
}

function getAppNote() {
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "";
  return '<p class="center"><small><a href="https://play.google.com/store/apps/details?id=es.monarc.distro" style="color:var(--green)">' + tr("get_app") + "</a></small></p>";
}
let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (!S.gid && S.groups) home(); });
addEventListener("appinstalled", () => { installPrompt = null; store("installHide", "1"); const c = $("instc"); if (c) c.remove(); });
// Tarjeta con cómo ponerla en la pantalla de inicio: el botón del sistema si el navegador lo ofrece (Chrome, Edge)
// y, si no, los pasos de cada navegador del móvil. No sale si ya está instalada o si se ha pedido no verla más.
function installNote() {
  const standalone = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: minimal-ui)").matches || navigator.standalone;
  if (standalone || load("installHide")) return "";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let how;
  if (installPrompt) how = '<button class="btn on" id="install" type="button">' + tr("install") + "</button>";
  else if (ios) how = "<p>" + tr("inst_ios") + "</p>";
  else if (/SamsungBrowser/i.test(ua)) how = "<p>" + tr("inst_samsung") + "</p>";
  else if (/Android/i.test(ua)) how = "<p>" + tr("inst_android") + "</p>";
  else return ""; // en el ordenador, solo si el navegador ofrece instalarla
  return '<section class="card" id="instc" aria-labelledby="insth"><div class="split" style="align-items:flex-start">' +
    '<img src="icon-192.png" alt="" width="40" height="40" style="border-radius:10px;flex:none">' +
    '<div class="grow"><strong id="insth">' + tr("inst_h") + "</strong><p>" + tr("inst_p") + "</p></div></div>" + how +
    '<button type="button" id="insthide" class="link" style="border:0;min-height:44px;padding:0;margin-top:4px">' + tr("inst_hide") + "</button></section>";
}

async function home() {
  stopPolling();
  S.gid = null; inGroup(null); homeAdd();
  header(tr("home_h1"), S.groups ? plural(S.groups.length, "groups_1", "groups_n") : "");
  if (!S.groups) { $("view").innerHTML = ""; $("skel").hidden = false; }
  try { S.groups = (await myGroups()).sort((a, b) => a.createdAt - b.createdAt); }
  catch (e) { return status(esc(tr("e_conn")), "bad", home); }
  if (S.gid) return; // ya se ha abierto un grupo mientras cargaba
  $("skel").hidden = true;
  header(tr("home_h1"), plural(S.groups.length, "groups_1", "groups_n"));
  $("view").innerHTML =
    (S.groups.length ? '<nav class="list" aria-label="' + tr("home_h1") + '">' + S.groups.map((g) => '<a href="#/g/' + g.id + '">' + avatar(g) +
      '<span class="grow"><span class="name">' + esc(g.name) + "</span><small>" + plural(g.people.length, "people_1", "people_n") + '</small></span><span class="chev" aria-hidden="true">›</span></a>').join("") + "</nav>"
      : '<div class="note">' + tr("no_groups") + "</div>") +
    installNote() +
    '<form class="card" id="joinf"><label for="code" style="margin-top:0">' + tr("join_title") + "</label>" +
    '<div class="split"><input id="code" name="code" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABC123" style="letter-spacing:.15em;text-transform:uppercase">' +
    '<button type="submit" class="on" style="flex:0 0 auto;margin:6px 0">' + tr("join_btn") + "</button></div></form>" +
    getAppNote();
  $("joinf").onsubmit = async (ev) => {
    ev.preventDefault();
    const code = clean($("code").value);
    if (!code) return status(esc(tr("e_code")), "bad");
    try { const gid = await join(code); if (gid) go(gid); }
    catch (e) { status(esc(tr("e_join")), "bad"); }
  };
  const ib = $("install");
  if (ib) ib.onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); const c = await installPrompt.userChoice; installPrompt = null; if (c.outcome === "accepted") $("instc").remove(); else home(); };
  const ih = $("insthide");
  if (ih) ih.onclick = () => { store("installHide", "1"); $("instc").remove(); };
}

async function openGroup(gid, tab) {
  S.tab = tab;
  if (S.gid !== gid) { S.gid = gid; S.group = null; S.sig = null; $("view").innerHTML = ""; $("skel").hidden = false; header("", ""); }
  else if (S.group) renderGroup(); // solo ha cambiado la pestaña
  inGroup(gid);
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
    if (!d) { stopPolling(); $("add").hidden = true; $("tabs").hidden = true; header(tr("home_h1")); $("view").innerHTML = '<p><a href="#/" class="link">' + tr("back") + "</a></p>"; return status(esc(tr("e_gone")), "bad"); }
    const sig = JSON.stringify([d, ex, tk]);
    if (sig === S.sig) return;
    S.sig = sig;
    S.group = toGroup(gid, d);
    cleanJoins(gid, d);
    S.expenses = ex.map((x) => toExpense(x.id, x.data)).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
    S.tickets = tk.map((x) => toTicket(x.id, x.data)).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
    if (S.group.recurring.length) applyRecurring(gid, ex.map((x) => x.id));
    if ($("status").className.indexOf("bad") >= 0) status("");
    renderGroup();
  } catch (e) {
    if (gid !== S.gid) return;
    if (S.group) status(esc(tr("e_conn")), "warn"); else status(esc(tr("e_conn")), "bad", refresh);
  }
}

// Los clientes antiguos dejaban en el grupo el código con el que entró cada uno (joins), y lo leen
// también los invitados. Cualquier miembro puede quitarlo: ya no hace falta para nada (E1).
const joinsCleaned = new Set();
function cleanJoins(gid, d) {
  if (joinsCleaned.has(gid) || !d.joins || !Object.keys(d.joins).length) return;
  joinsCleaned.add(gid);
  commit([{ update: { name: docName("groups/" + gid), fields: {} }, updateMask: { fieldPaths: ["joins"] }, currentDocument: { exists: true } }])
    .catch((e) => console.warn("joins", e));
}

function personName(id) { const p = S.group.people.find((x) => x.id === id); return p ? p.name : "?"; }
function nameYou(id) { return personName(id) + (id === S.group.me ? " (" + tr("you") + ")" : ""); }
function myName() { return S.group && S.group.me ? personName(S.group.me) : (S.user.displayName || ""); }

function renderGroup() {
  const g = S.group;
  $("skel").hidden = true;
  const spent = S.expenses.filter((e) => !e.isTransfer).reduce((a, e) => a + e.amountCents, 0);
  header((g.icon ? g.icon + " " : "") + g.name, plural(g.people.length, "people_1", "people_n") + " · " + money(spent));
  const meOk = g.me && g.people.some((p) => p.id === g.me);
  let h = "";
  if (!meOk) h += whoCard();
  if (S.tickets.length) h += ticketsHtml();
  h += S.tab === "exp" ? expensesHtml() : S.tab === "bal" ? balancesHtml() : statsHtml();
  $("view").innerHTML = h;
  inGroup(g.id);
  $("back").setAttribute("aria-label", tr("back_lbl"));
  $("tabs").setAttribute("aria-label", tr("sections"));
  wireGroup();
}

function whoCard() {
  const g = S.group, own = (S.user.displayName || "").trim();
  // Se propone el nombre de la cuenta solo si nadie del grupo se llama ya así.
  const suggested = own && !g.people.some((p) => p.name.trim().toLowerCase() === own.toLowerCase()) ? own : "";
  return "<h2>" + tr("who_title") + "</h2><p>" + tr("who_hint") + "</p>" +
    '<div class="list">' + g.people.map((p) => {
      const taken = g.taken.indexOf(p.id) >= 0;
      return '<button type="button" data-who="' + p.id + '"><span class="av" aria-hidden="true">' + initial(p.name) + '</span><span class="grow"><span class="name">' + esc(p.name) + "</span>" +
        (taken ? "<small>" + tr("taken") + "</small>" : "") + '</span><span class="chev" aria-hidden="true">›</span></button>';
    }).join("") + "</div>" +
    '<form class="card" id="addme"><label for="myname" style="margin-top:0">' + tr("not_listed") + '</label><input id="myname" name="name" maxlength="60" required autocomplete="name" placeholder="' + tr("name_ph") + '" value="' + esc(suggested) + '">' +
    '<button class="btn" type="submit">' + tr("add_me") + "</button></form>";
}

const signed = (c) => (c > 0 ? "+" : c < 0 ? "−" : "") + money(Math.abs(c));
const tone = (c) => (c > 0 ? "pos" : c < 0 ? "neg" : "");

// Tabla de gastos: fecha, concepto (con quién pagó y tu parte) e importe. Los pagos entre personas van en gris.
function expensesHtml() {
  if (!S.expenses.length) return '<div class="note">' + tr("no_exp") + "</div>";
  const me = S.group.me, n = S.expenses.filter((e) => !e.isTransfer).length;
  return "<table><caption>" + plural(n, "exp_1", "exp_n") + "</caption>" +
    '<thead><tr><th scope="col">' + tr("col_date") + '</th><th scope="col">' + tr("col_what") + '</th><th scope="col" class="n">' + tr("col_amount") + "</th></tr></thead><tbody>" +
    S.expenses.map((e) => {
      if (e.isTransfer) {
        const to = Object.keys(e.shares)[0];
        return '<tr class="xfer"><td class="d">' + day(e.createdAt) + '</td><td><button type="button" class="rowbtn" data-exp="' + e.id + '" aria-label="' + esc(tr("open_pay", nameYou(e.payerId), to ? nameYou(to) : "?", money(e.amountCents))) + '">' +
          '<span class="what">' + esc(nameYou(e.payerId)) + ' <span aria-hidden="true">→</span> ' + esc(to ? nameYou(to) : "?") +
          "</span><small>" + esc(e.title) + '</small></button></td><td class="n big">' + money(e.amountCents) + "</td></tr>";
      }
      const mine = me && e.shares[me] ? " · " + tr("your_share", money(e.shares[me])) : "";
      const orig = e.currency ? "<small>" + esc(tr("paid_orig", money(e.originalCents, e.currency), e.currency, rateLocal(e.rate), S.group.currency)) + "</small>" : "";
      return '<tr><td class="d">' + day(e.createdAt) + '</td><td><button type="button" class="rowbtn" data-exp="' + e.id + '" aria-label="' + esc(tr("open_exp", e.title, money(e.amountCents))) + '">' +
        '<span class="what"><span aria-hidden="true">' + expenseEmoji(e) + "</span> " + esc(e.title) + "</span><small>" + esc(tr("paid_by", nameYou(e.payerId)) + mine) +
        "</small>" + orig + '</button></td><td class="n big">' + money(e.amountCents) + "</td></tr>";
    }).join("") + "</tbody></table>";
}

// Tabla de saldos (lo que pagó, lo que le toca y la diferencia) y debajo los pagos para quedar en paz.
function balancesHtml() {
  const g = S.group, bal = balances(g, S.expenses), me = g.me, paid = {}, share = {};
  let transfers = false;
  S.expenses.forEach((e) => {
    if (e.isTransfer) { transfers = true; return; }
    paid[e.payerId] = (paid[e.payerId] || 0) + e.amountCents;
    Object.keys(e.shares).forEach((id) => { share[id] = (share[id] || 0) + e.shares[id]; });
  });
  const people = g.people.slice().sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0));
  let h = "<table><caption>" + tr("tab_bal") + "</caption>" +
    '<thead><tr><th scope="col">' + tr("col_person") + '</th><th scope="col" class="n">' + tr("col_paid") + '</th><th scope="col" class="n">' + tr("col_share") +
    '</th><th scope="col" class="n">' + tr("col_bal") + "</th></tr></thead><tbody>" +
    people.map((p) => {
      const v = bal[p.id] || 0;
      return '<tr><th scope="row" class="p">' + esc(nameYou(p.id)) + '</th><td class="n">' + money(paid[p.id] || 0) + '</td><td class="n">' + money(share[p.id] || 0) +
        '</td><td class="n s ' + tone(v) + '">' + signed(v) + "</td></tr>";
    }).join("") + "</tbody></table>" +
    '<p class="foot">' + tr("bal_foot") + (transfers ? " " + tr("bal_foot_x") : "") + "</p>";
  const ts = settle(bal);
  h += "<h2>" + tr("settle_title") + "</h2>";
  if (!ts.length) return h + '<div class="note">' + tr("all_settled") + "</div>";
  h += ts.map((t, i) => {
    const label = t.from === me ? tr("i_paid") : t.to === me ? tr("they_paid") : tr("paid_short");
    const strong = t.from === me || t.to === me;
    return '<div class="pay"><span class="who"><b>' + esc(nameYou(t.from)) + '</b> <span class="arrow" aria-hidden="true">→</span><span class="sr"> ' + tr("pays_to") + " </span> <b>" + esc(nameYou(t.to)) + "</b></span>" +
      '<span class="amt">' + money(t.cents) + '</span><button type="button" data-pay="' + i + '"' + (strong ? ' class="on"' : "") + ">" + label + "</button></div>";
  }).join("");
  S.transfers = ts;
  return h;
}

function wireGroup() {
  wireTickets();
  document.querySelectorAll("[data-who]").forEach((b) => { b.onclick = () => pickMe(b.dataset.who); });
  document.querySelectorAll("[data-pay]").forEach((b) => { b.onclick = () => markPaid(S.transfers[Number(b.dataset.pay)], b); });
  document.querySelectorAll("[data-exp]").forEach((b) => {
    b.onclick = () => {
      const e = S.expenses.find((x) => x.id === b.dataset.exp); if (!e) return;
      // Un pago entre personas no se edita: se borra (y se puede deshacer).
      if (e.isTransfer) { if (confirm(tr("confirm_del_pay", money(e.amountCents)))) deleteExpense(e, true); }
      else openExpense(e);
    };
  });
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
async function guarded(fn, btn, noRefresh) {
  if (S.busy) return;
  S.busy = true;
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = tr("saving"); }
  try { await fn(); S.sig = null; if (!noRefresh) await refresh(); return true; }
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
  guarded(() => commit([expenseWrite(e), activityWrite("refund", e.title, e.amountCents)]), btn).then((ok) => { if (ok) flash(tr("paid_ok"), () => deleteExpense(e, false)); });
}

// --- Gastos: nuevo, editar y borrar (como ExpenseDialog en la app) ---
// Modos: a partes iguales, por partes (2×, 1×…), por importes y por porcentajes. Se guarda siempre lo
// que le toca a cada uno en céntimos (shares), así que la app entiende los cuatro igual.
function closeSheet() {
  const s = $("sheet"), was = !s.hidden;
  s.hidden = true; s.innerHTML = "";
  if (was && !$("add").hidden) $("add").focus({ preventScroll: true }); // el foco vuelve a «+ Gasto»
}
function parseCents(s) {
  s = (s || "").trim().replace(/\s/g, "");
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(s)) return 0;
  return Math.round(parseFloat(s.replace(",", ".")) * 100);
}
// Porcentaje en centésimas de punto ("33,33" → 3333); -1 si no vale.
function parsePct(s) {
  s = (s || "").trim().replace(/\s|%/g, "");
  if (!s) return 0;
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(s)) return -1;
  const v = Math.round(parseFloat(s.replace(",", ".")) * 100);
  return v <= 10000 ? v : -1;
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
function centsText(c) { return (c / 100).toFixed(2).replace(".", LANG === "en" ? "." : ","); }
function pctText(bp) { return (bp / 100).toFixed(bp % 100 ? 2 : 0).replace(".", LANG === "en" ? "." : ","); }
// Tipo de cambio: como rateString/parseRate de la app.
function rateString(r) { let s = String(r); if (/e/i.test(s)) s = r.toFixed(12).replace(/0+$/, "").replace(/\.$/, ""); return s; }
function parseRate(s) { const v = Number((s || "").trim().replace(",", ".")); return v > 0 && isFinite(v) ? v : null; }
function rateLocal(r) { return LANG === "en" ? rateString(r) : rateString(r).replace(".", ","); }
// Céntimos × tipo, redondeado a medio céntimo hacia arriba y sin errores de coma flotante (Fx.convert).
function convert(cents, rate) {
  const [i, f = ""] = rateString(rate).split("."), N = BigInt(i + f), D = 10n ** BigInt(f.length);
  return Number((BigInt(cents) * N * 2n + D) / (2n * D));
}
function splitMap(total, shares) {
  const ids = Object.keys(shares), p = splitCents(total, ids.map((k) => shares[k])), o = {};
  ids.forEach((k, i) => { o[k] = p[i]; });
  return o;
}
const convertShares = (shares, rate) => splitMap(convert(sum(shares), rate), shares); // Fx.convertShares
const toForeignShares = (shares, original) => splitMap(original, shares); // Fx.toForeignShares
function isEqualSplit(e) {
  const ids = S.group.people.map((p) => p.id).filter((id) => id in e.shares);
  if (ids.length !== Object.keys(e.shares).length) return false;
  const eq = equalShares(e.amountCents, ids);
  return ids.every((id) => eq[id] === e.shares[id]);
}

// Tipo de cambio de hoy, como RateFetcher: Frankfurter (BCE) y, si no, una API pública con más monedas.
async function fetchRate(from, to) {
  const get = async (url) => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
  };
  const clean = (v) => (typeof v === "number" && v > 0 && isFinite(v) ? Number(v.toPrecision(6)) : null);
  let j = await get("https://api.frankfurter.dev/v1/latest?base=" + from + "&symbols=" + to);
  let v = j && j.rates ? clean(j.rates[to]) : null;
  for (const u of ["https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/", "https://latest.currency-api.pages.dev/v1/currencies/"]) {
    if (v) break;
    j = await get(u + from.toLowerCase() + ".json");
    v = j && j[from.toLowerCase()] ? clean(j[from.toLowerCase()][to.toLowerCase()]) : null;
  }
  return v;
}

const expPath = (id) => "groups/" + S.gid + "/expenses/" + id;
// how: "create" (no existe), "set" (lo sustituye entero al editar) o "restore" (deshacer un borrado).
function expenseWrite(e, how) {
  const shares = {};
  Object.keys(e.shares).forEach((k) => { shares[k] = int(e.shares[k]); });
  const fields = {
    title: str(e.title), payerId: int(e.payerId), amountCents: int(e.amountCents), shares: mv(shares),
    createdAt: int(e.createdAt), isTransfer: bool(e.isTransfer), updatedBy: str(S.user.uid),
  };
  if (e.currency && e.originalCents != null && e.rate) {
    fields.currency = str(e.currency); fields.originalCents = int(e.originalCents); fields.rate = { doubleValue: e.rate };
  }
  if (how === "restore") fields.deleted = bool(false);
  return {
    update: { name: docName(expPath(e.id)), fields },
    updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    currentDocument: { exists: how === "set" || how === "restore" },
  };
}
// Borrado suave, como la app: el gasto se queda marcado y se puede deshacer.
function deleteExpense(x, undoable) {
  return guarded(() => commit([
    { update: { name: docName(expPath(x.id)), fields: { deleted: bool(true), updatedBy: str(S.user.uid) } },
      updateMask: { fieldPaths: ["deleted", "updatedBy"] }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }], currentDocument: { exists: true } },
    activityWrite("expense_deleted", x.title, x.amountCents),
  ])).then((ok) => { if (ok && undoable) flash(tr(x.isTransfer ? "pay_deleted" : "exp_deleted"), () => restoreExpense(x)); return ok; });
}
function restoreExpense(x) {
  guarded(() => commit([expenseWrite(x, "restore"), activityWrite(x.isTransfer ? "refund" : "expense_added", x.title, x.amountCents)]))
    .then((ok) => { if (ok) flash(tr("restored")); });
}
function openAddExpense(pre) { openExpense(null, pre); }

function openExpense(e, pre) {
  const g = S.group, sheet = $("sheet"), people = g.people, ids = people.map((p) => p.id);
  const foreign0 = e && e.currency && e.originalCents != null && e.rate ? e.currency : null;
  const base = e ? (foreign0 ? toForeignShares(e.shares, e.originalCents) : e.shares) : null;
  const st = {
    mode: !e || isEqualSplit(e) ? "eq" : "amt",
    cur: foreign0 || g.currency,
    rate: e && e.rate ? rateLocal(e.rate) : "",
    rateEdited: !!(e && e.rate),
    rateStatus: "",
    sel: new Set(e ? Object.keys(e.shares).filter((id) => ids.indexOf(id) >= 0) : ids),
    weights: {}, amounts: {}, pcts: {},
    title: e ? e.title : pre ? pre.title : "",
    amount: e ? centsText(foreign0 ? e.originalCents : e.amountCents) : pre ? centsText(pre.cents) : "",
    payer: e ? e.payerId : pre && pre.payer ? pre.payer : g.me && ids.indexOf(g.me) >= 0 ? g.me : ids[0],
    monthly: false,
  };
  ids.forEach((id) => { st.weights[id] = 1; st.amounts[id] = base && base[id] ? centsText(base[id]) : ""; st.pcts[id] = ""; });
  const curList = CURRENCIES.indexOf(g.currency) >= 0 ? CURRENCIES.slice() : [g.currency].concat(CURRENCIES);
  if (curList.indexOf(st.cur) < 0) curList.unshift(st.cur);
  const foreign = () => st.cur !== g.currency;

  // Al pasar a porcentajes se reparte el 100 % entre los marcados (el resto de centésimas, a los primeros).
  function fillPcts() {
    const on = ids.filter((id) => st.sel.has(id)), p = splitCents(10000, on.map(() => 1));
    ids.forEach((id) => { st.pcts[id] = ""; });
    on.forEach((id, i) => { st.pcts[id] = pctText(p[i]); });
  }
  // Lo que le toca a cada uno en la moneda del gasto; { err } si algo no vale.
  function compute() {
    if (st.mode === "amt") {
      const sh = {};
      for (const id of ids) {
        const t = (st.amounts[id] || "").trim();
        if (!t) continue;
        const c = parseCents(t);
        if (!c && !/^0+([.,]0{1,2})?$/.test(t)) return { err: "e_amounts", field: "am_" + id };
        if (c) sh[id] = c;
      }
      return sum(sh) > 0 ? { shares: sh, cents: sum(sh) } : { err: "e_amount", field: "am_" + ids[0] };
    }
    const cents = parseCents(st.amount);
    if (cents <= 0) return { err: "e_amount", field: "ea" };
    if (st.mode === "eq") {
      const on = ids.filter((id) => st.sel.has(id));
      return on.length ? { shares: equalShares(cents, on), cents } : { err: "e_between", field: "eb" };
    }
    if (st.mode === "parts") {
      const w = ids.map((id) => st.weights[id] || 0);
      if (!w.some((x) => x > 0)) return { err: "e_between", field: "eb" };
      const p = splitCents(cents, w), sh = {};
      ids.forEach((id, i) => { if (p[i] > 0) sh[id] = p[i]; });
      return { shares: sh, cents };
    }
    const bp = ids.map((id) => parsePct(st.pcts[id]));
    const bad = bp.findIndex((x) => x < 0);
    if (bad >= 0) return { err: "e_pct", field: "pc_" + ids[bad] };
    const total = bp.reduce((a, b) => a + b, 0);
    if (total !== 10000) return { err: "e_pct", field: "pc_" + ids[0], pct: total };
    const p = splitCents(cents, bp), sh = {};
    ids.forEach((id, i) => { if (p[i] > 0) sh[id] = p[i]; });
    return { shares: sh, cents };
  }

  function peopleHtml() {
    const cur = st.cur;
    if (st.mode === "eq") {
      return '<div class="chips" id="eb" role="group" aria-labelledby="eml">' + people.map((p) =>
        '<button type="button" aria-pressed="' + st.sel.has(p.id) + '" data-p="' + p.id + '">' + esc(p.name) + "</button>").join("") + "</div>";
    }
    if (st.mode === "parts") {
      return '<div id="eb"><small>' + tr("parts_hint") + "</small>" + people.map((p) => {
        const n = st.weights[p.id] || 0;
        return '<div class="prow"><span class="grow">' + esc(p.name) + "</span>" +
          '<button type="button" class="step" data-w="-1" data-p="' + p.id + '" aria-label="' + esc(tr("less_for", p.name)) + '"' + (n <= 0 ? " disabled" : "") + ">−</button>" +
          '<b class="cnt" aria-live="polite">' + n + "×</b>" +
          '<button type="button" class="step" data-w="1" data-p="' + p.id + '" aria-label="' + esc(tr("more_for", p.name)) + '"' + (n >= 99 ? " disabled" : "") + ">+</button>" +
          '<span class="amt out" data-out="' + p.id + '"></span></div>';
      }).join("") + "</div>";
    }
    const amt = st.mode === "amt";
    return '<div id="eb">' + people.map((p) =>
      '<div class="prow"><label class="grow" for="' + (amt ? "am_" : "pc_") + p.id + '">' + esc(p.name) + "</label>" +
      '<input id="' + (amt ? "am_" : "pc_") + p.id + '" data-' + (amt ? "am" : "pc") + '="' + p.id + '" inputmode="decimal" autocomplete="off" class="num" value="' + esc(amt ? st.amounts[p.id] : st.pcts[p.id]) + '"' +
      ' aria-label="' + esc(tr(amt ? "amount_of" : "pct_of", p.name)) + '" placeholder="' + (amt ? "0,00" : "0") + '">' +
      '<span class="unit" aria-hidden="true">' + (amt ? esc(cur) : "%") + "</span>" + (amt ? "" : '<span class="amt out" data-out="' + p.id + '"></span>') + "</div>").join("") + "</div>";
  }

  function draw(focusId) {
    const f = foreign();
    sheet.innerHTML = '<form id="expf" novalidate role="dialog" aria-modal="true" aria-labelledby="eh"><h2 id="eh">' + tr(e ? "edit_exp" : "new_exp") + "</h2>" +
      (!e && !pre ? '<button type="button" class="btn" id="escan" style="margin:8px 0 4px">' + tr("scan_btn") + "</button>" : "") +
      '<label for="ec">' + tr("concept") + '</label><input id="ec" name="concept" maxlength="120" placeholder="' + tr("concept_ph") + '" autocomplete="off" value="' + esc(st.title) + '">' +
      '<label for="ea">' + tr(st.mode === "amt" ? "total_lbl" : "amount_lbl") + '</label><div class="split"><input id="ea" name="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" value="' + esc(st.amount) + '"' + (st.mode === "amt" ? " readonly" : "") + ">" +
      '<select id="ecur" aria-label="' + tr("paid_in") + '" style="flex:0 0 6.2em">' + curList.map((c) => '<option value="' + c + '"' + (c === st.cur ? " selected" : "") + ">" + c + "</option>").join("") + "</select></div>" +
      (f ? '<label for="erate">' + tr("rate_lbl", esc(st.cur), esc(g.currency)) + '</label><input id="erate" inputmode="decimal" autocomplete="off" value="' + esc(st.rate) + '"><small id="erst" aria-live="polite">' + esc(st.rateStatus) + "</small>" : "") +
      '<label for="ep">' + tr("paid_by_lbl") + '</label><select id="ep" name="payer">' + people.map((p) => '<option value="' + p.id + '"' + (p.id === st.payer ? " selected" : "") + ">" + esc(nameYou(p.id)) + "</option>").join("") + "</select>" +
      '<label id="eml">' + tr("m_label") + '</label><div class="seg" role="group" aria-labelledby="eml">' + [["eq", "m_equal"], ["parts", "m_parts"], ["amt", "m_amounts"], ["pct", "m_pct"]].map(([m, k]) =>
        '<button type="button" data-mode="' + m + '" aria-pressed="' + (st.mode === m) + '">' + tr(k) + "</button>").join("") + "</div>" +
      peopleHtml() +
      '<p id="each" aria-live="polite" class="foot"></p>' +
      (!e && !f ? '<label class="chk"><input type="checkbox" id="emon"' + (st.monthly ? " checked" : "") + "> " + tr("repeat") + "</label><small>" + tr("repeat_hint") + "</small>" : "") +
      '<p class="err" id="eerr" role="alert" style="color:var(--bad)"></p>' +
      '<div class="split">' + (e ? '<button type="button" id="edel" class="danger">' + tr("delete_exp") + "</button>" : "") +
      '<button type="button" id="ecancel">' + tr("cancel") + '</button><button type="submit" class="on" id="esave">' + tr("save") + "</button></div></form>";
    sheet.hidden = false;
    wire();
    upd();
    if (focusId && $(focusId)) $(focusId).focus();
  }

  function upd() {
    const r = compute(), out = $("each"), cur = st.cur, f = foreign(), rate = f ? parseRate(st.rate) : 1;
    if (!r.err) document.querySelectorAll('#eb [aria-invalid], #ea[aria-invalid]').forEach((n) => n.removeAttribute("aria-invalid"));
    let txt = "";
    if (st.mode === "amt") {
      const c = ids.reduce((a, id) => a + parseCents(st.amounts[id]), 0);
      $("ea").value = c ? centsText(c) : "";
    }
    if (st.mode === "eq" && r.shares) txt = tr("each", money(Math.floor(r.cents / Object.keys(r.shares).length), cur));
    if (st.mode === "pct") {
      const total = ids.reduce((a, id) => a + Math.max(0, parsePct(st.pcts[id])), 0);
      txt = total === 10000 ? tr("pct_ok") : tr("pct_sum", pctText(total));
    }
    if ((st.mode === "parts" || st.mode === "pct")) {
      document.querySelectorAll("[data-out]").forEach((n) => { const v = r.shares && r.shares[n.dataset.out]; n.textContent = v ? money(v, cur) : ""; });
    }
    if (r.cents && st.mode !== "eq" && st.mode !== "pct") txt = tr("total_is", money(r.cents, cur));
    if (f && rate && r.cents) txt += (txt ? " · " : "") + tr("rate_preview", money(convert(r.cents, rate), g.currency));
    out.textContent = txt;
  }

  async function lookRate() {
    if (!foreign() || st.rateEdited) return;
    const cur = st.cur;
    st.rateStatus = tr("rate_loading"); if ($("erst")) $("erst").textContent = st.rateStatus;
    const v = await fetchRate(cur, g.currency);
    if (cur !== st.cur || st.rateEdited || !$("erate")) return;
    if (v) { st.rate = rateLocal(v); st.rateStatus = tr("rate_auto"); $("erate").value = st.rate; }
    else st.rateStatus = tr("rate_failed");
    $("erst").textContent = st.rateStatus;
    upd();
  }

  function keep() { st.title = $("ec").value; if (st.mode !== "amt") st.amount = $("ea").value; st.payer = $("ep").value; if ($("emon")) st.monthly = $("emon").checked; if ($("erate")) st.rate = $("erate").value; }

  function wire() {
    const err = $("eerr");
    $("ec").oninput = () => { $("ec").removeAttribute("aria-invalid"); err.textContent = ""; };
    $("ea").oninput = () => { st.amount = $("ea").value; $("ea").removeAttribute("aria-invalid"); err.textContent = ""; upd(); };
    $("ecur").onchange = () => {
      keep(); st.cur = $("ecur").value; st.rateEdited = false; st.rateStatus = "";
      st.rate = foreign() ? load("rate:" + st.cur + ">" + g.currency) || "" : "";
      if (foreign()) st.monthly = false;
      draw("ecur"); lookRate();
    };
    if ($("erate")) $("erate").oninput = () => { st.rate = $("erate").value; st.rateEdited = true; st.rateStatus = ""; $("erst").textContent = ""; upd(); };
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.onclick = () => {
        keep(); const m = b.dataset.mode; if (m === st.mode) return;
        if (m === "amt" && !ids.some((id) => st.amounts[id])) {
          // Al pasar a importes se parte de lo que había (por ejemplo, a partes iguales).
          const r = compute(); if (r.shares) ids.forEach((id) => { st.amounts[id] = r.shares[id] ? centsText(r.shares[id]) : ""; });
        }
        if (m === "pct" && !ids.some((id) => st.pcts[id])) fillPcts();
        if (st.mode === "amt") { const c = ids.reduce((a, id) => a + parseCents(st.amounts[id]), 0); if (c) st.amount = centsText(c); }
        st.mode = m; draw();
        const nb = document.querySelector('[data-mode="' + m + '"]'); if (nb) nb.focus();
      };
    });
    $("eb").onclick = (ev) => {
      const b = ev.target.closest("button[data-p]"); if (!b) return;
      const id = b.dataset.p;
      if (st.mode === "eq") { if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id); b.setAttribute("aria-pressed", String(st.sel.has(id))); }
      else if (st.mode === "parts") {
        st.weights[id] = Math.max(0, Math.min(99, (st.weights[id] || 0) + Number(b.dataset.w)));
        const row = b.closest(".prow"); row.querySelector(".cnt").textContent = st.weights[id] + "×";
        row.querySelector('[data-w="-1"]').disabled = st.weights[id] <= 0; row.querySelector('[data-w="1"]').disabled = st.weights[id] >= 99;
      }
      err.textContent = ""; upd();
    };
    $("eb").oninput = (ev) => {
      const t = ev.target; t.removeAttribute("aria-invalid"); err.textContent = "";
      if (t.dataset.am) st.amounts[t.dataset.am] = t.value; else if (t.dataset.pc) st.pcts[t.dataset.pc] = t.value;
      upd();
    };
    if ($("escan")) $("escan").onclick = () => openScan();
    if ($("edel")) $("edel").onclick = () => { if (confirm(tr("confirm_del_exp", e.title))) { closeSheet(); deleteExpense(e, true); } };
    $("ecancel").onclick = closeSheet;
    sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
    $("expf").onsubmit = async (ev) => {
      ev.preventDefault();
      keep();
      const bad = (id, msg) => { err.textContent = msg; const f = $(id); if (!f) return; if (f.tagName === "INPUT") f.setAttribute("aria-invalid", "true"); (f.tagName === "DIV" ? f.querySelector("button, input") : f).focus(); };
      const title = st.title.trim();
      if (!title) return bad("ec", tr("e_concept"));
      const r = compute();
      if (r.err) return bad(r.field, tr(r.err));
      const f = foreign(), rate = f ? parseRate(st.rate) : 1;
      if (!rate) return bad("erate", tr("e_rate"));
      const inGroup = f ? convertShares(r.shares, rate) : r.shares;
      if (f) store("rate:" + st.cur + ">" + g.currency, rateLocal(rate));
      const x = {
        id: e ? e.id : newId(), title, payerId: st.payer, amountCents: sum(inGroup), shares: inGroup,
        createdAt: e ? e.createdAt : Date.now(), isTransfer: false,
        currency: f ? st.cur : null, originalCents: f ? sum(r.shares) : null, rate: f ? rate : null,
      };
      err.textContent = "";
      let writes;
      if (e) writes = [expenseWrite(x, "set"), activityWrite("expense_edited", title, x.amountCents)];
      else if (st.monthly && !f) {
        // El primer mes se guarda con el id del mes 0 de la repetición (Recurring.from en la app).
        const rec = { id: newId(), title, payerId: x.payerId, amountCents: x.amountCents, shares: x.shares, startAt: x.createdAt, applied: 1 };
        x.id = recurringExpenseId(rec.id, 0);
        writes = [expenseWrite(x, "create"), recurringWrite(rec), activityWrite("expense_added", title, x.amountCents)];
      } else writes = [expenseWrite(x, "create"), activityWrite("expense_added", title, x.amountCents)];
      const ok = await guarded(() => commit(writes), $("esave"));
      if (ok) {
        closeSheet();
        if (S.tab !== "exp") location.hash = "#/g/" + S.gid + "/gastos"; else renderGroup();
        flash(tr(e ? "edited" : "saved"));
      } else err.textContent = tr("e_save");
    };
  }

  draw();
  if (!e && matchMedia("(pointer: fine)").matches) setTimeout(() => $("ec") && $("ec").focus(), 50);
  if (foreign() && !st.rateEdited) lookRate();
}

// --- Gastos que se repiten cada mes (Recurring.kt) ---
// El id de cada mes sale del de la repetición y del número de mes, igual que en la app: si dos
// móviles (o la app y la web) lo apuntan a la vez, escriben el mismo gasto y no sale repetido.
function recurringExpenseId(rid, period) {
  const M = (v) => BigInt.asIntN(64, v);
  let r = (M(BigInt(rid) * 1000003n) ^ M(BigInt(period) * -0x61c8864680b583ebn)) & 0x7fffffffffffffffn;
  if (r < 1n) r = 1n;
  return r.toString();
}
// Mismo día del mes, n meses después; el 31 cae en el último día de los meses cortos (Calendar.add).
function addMonths(ms, n) {
  const d = new Date(ms), t = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return t.getTime();
}
// Meses que faltan por apuntar (como mucho 12) y el valor nuevo de `applied` (Recurring.pending).
function recurringPending(r, now) {
  if (now < r.startAt) return { periods: [], due: r.applied };
  let n = Math.max(1, r.applied);
  while (addMonths(r.startAt, n) <= now) n++;
  if (n <= r.applied) return { periods: [], due: r.applied };
  const periods = [];
  for (let p = Math.max(r.applied, n - 12); p < n; p++) periods.push(p);
  return { periods, due: n };
}
function recurringWrite(r) {
  const sh = {};
  Object.keys(r.shares).forEach((k) => { sh[k] = int(r.shares[k]); });
  return {
    update: { name: groupDoc(), fields: { recurring: mv({ [r.id]: mv({
      title: str(r.title), payerId: int(r.payerId), amountCents: int(r.amountCents), shares: mv(sh), startAt: int(r.startAt), applied: int(r.applied),
    }) }) } },
    updateMask: { fieldPaths: ["recurring." + tick(r.id)] },
  };
}
const applying = new Set();
// Apunta los meses que ya han llegado a su fecha (applyRecurring en la app): lo hace quien abre antes el grupo.
function applyRecurring(gid, knownIds) {
  const now = Date.now(), known = new Set(knownIds);
  for (const r of S.group.recurring) {
    const { periods, due } = recurringPending(r, now), key = gid + ":" + r.id + ":" + due;
    if (!periods.length || applying.has(key)) continue;
    applying.add(key);
    const writes = [];
    periods.forEach((p) => {
      const x = { id: recurringExpenseId(r.id, p), title: r.title, payerId: r.payerId, amountCents: r.amountCents, shares: r.shares, createdAt: addMonths(r.startAt, p), isTransfer: false };
      if (known.has(x.id)) return; // ya lo apuntó otro (quizá con la caché atrasada)
      writes.push(expenseWrite(x, "create"), activityWrite("expense_added", x.title, x.amountCents));
    });
    writes.push(recurringWrite(Object.assign({}, r, { applied: due })));
    commit(writes).then(() => { if (S.gid === gid) { S.sig = null; refresh(); } }).catch((e) => console.warn("recurring", e));
  }
}

// --- Categorías y emojis (Category.of y expenseEmoji en la app) ---
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Mn}+/gu, "");
const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const match = (title, table, dflt) => { const w = words(title); const hit = table.find(([keys]) => w.some((x) => keys.some((k) => x.startsWith(k)))); return hit ? hit[1] : dflt; };
const CATS = [
  [["viaje", "vacaciones", "escapada", "finde", "playa", "boda", "trip", "vacation", "holiday", "weekend", "beach", "wedding", "viatge", "vacances", "platja", "casament"], "trips"],
  [["pizza", "pizzeria", "hamburg", "burger", "sushi", "japones", "cena", "comida", "almuerzo", "restaurante", "menu", "tapas", "desayuno", "cafe", "cafeteria", "helado", "dinner", "lunch", "restaurant", "breakfast", "coffee", "brunch", "meal", "sopar", "dinar", "esmorzar", "tapes", "menjar", "gelat"], "food"],
  [["cerveza", "cana", "copas", "vino", "bebida", "bar", "beer", "drinks", "wine", "pub", "cocktail", "cervesa", "canya", "copes", "beguda"], "drinks"],
  [["super", "mercadona", "lidl", "carrefour", "dia", "alcampo", "compra", "grocery", "groceries", "supermarket", "shopping", "bonpreu", "condis", "esclat"], "groceries"],
  [["taxi", "uber", "cabify", "gasolina", "gasoil", "diesel", "repsol", "cepsa", "tren", "renfe", "ave", "avion", "vuelo", "ryanair", "vueling", "iberia", "bus", "autobus", "metro", "parking", "aparcamiento", "peaje", "lyft", "gas", "fuel", "petrol", "train", "flight", "toll", "subway", "benzina", "avio", "aparcament", "peatge"], "transport"],
  [["hotel", "airbnb", "apartamento", "alojamiento", "hostal", "alquiler", "piso", "casa", "hostel", "rent", "flat", "house", "apartment", "allotjament", "pis", "lloguer"], "lodging"],
  [["museo", "museu", "entrad", "teatre", "concierto", "cine", "teatro", "museum", "concert", "cinema", "movie", "theatre", "theater"], "leisure"],
  [["luz", "electricidad", "agua", "internet", "wifi", "fibra", "electricity", "water", "bill", "fiber", "llum", "electricitat", "aigua"], "bills"],
  [["regal", "cumple", "gift", "present", "birthday", "aniversari"], "gifts"],
  [["farmacia", "pharmacy", "drugstore"], "health"],
];
const CAT_EMOJI = { food: "🍽️", drinks: "🍻", groceries: "🛒", transport: "🚕", lodging: "🏨", leisure: "🎟️", bills: "💡", gifts: "🎁", health: "💊", trips: "🧳", other: "🧾" };
const EMOJIS = [
  [["reembolso", "devol", "refund", "repay"], "💸"], [["viaje", "vacaciones", "escapada", "finde", "trip", "vacation", "holiday", "weekend", "getaway", "viatge", "vacances"], "🧳"],
  [["playa", "beach", "platja"], "🏖️"], [["boda", "wedding", "casament"], "💍"], [["pizza", "pizzeria"], "🍕"], [["hamburg", "burger"], "🍔"], [["sushi", "japones"], "🍣"],
  [["cena", "comida", "almuerzo", "restaurante", "menu", "tapas", "bar", "dinner", "lunch", "restaurant", "meal", "brunch", "sopar", "dinar", "tapes", "menjar"], "🍽️"],
  [["desayuno", "cafe", "cafeteria", "breakfast", "coffee", "esmorzar"], "☕"],
  [["cerveza", "cana", "copas", "vino", "bebida", "beer", "drinks", "wine", "pub", "cocktail", "cervesa", "canya", "copes", "beguda"], "🍻"], [["helado", "ice", "gelat"], "🍦"],
  [["super", "mercadona", "lidl", "carrefour", "dia", "alcampo", "compra", "grocer", "supermarket", "shopping", "bonpreu", "condis", "esclat"], "🛒"],
  [["taxi", "uber", "cabify", "lyft"], "🚕"], [["gasolina", "gasoil", "diesel", "repsol", "cepsa", "gas", "fuel", "petrol", "benzina"], "⛽"], [["tren", "renfe", "ave", "train"], "🚆"],
  [["avion", "vuelo", "ryanair", "vueling", "iberia", "flight", "plane", "avio"], "✈️"], [["bus", "autobus", "metro", "subway"], "🚌"], [["parking", "aparcamiento", "peaje", "toll", "aparcament", "peatge"], "🅿️"],
  [["hotel", "airbnb", "apartamento", "alojamiento", "hostal", "hostel", "lodging", "apartment", "allotjament"], "🏨"],
  [["museo", "museu", "entrad", "teatre", "concierto", "cine", "teatro", "museum", "ticket", "concert", "cinema", "movie", "theatre", "theater"], "🎟️"],
  [["luz", "electricidad", "electricity", "power", "llum", "electricitat"], "💡"], [["agua", "water", "aigua"], "💧"], [["internet", "wifi", "fibra", "fiber"], "📶"],
  [["alquiler", "piso", "casa", "rent", "flat", "house", "pis", "lloguer"], "🏠"], [["regalo", "cumple", "gift", "present", "birthday", "regal", "aniversari"], "🎁"], [["farmacia", "pharmacy", "drugstore"], "💊"],
];
const categoryOf = (title) => match(title, CATS, "other");
const expenseEmoji = (e) => (e.isTransfer ? "💸" : match(e.title, EMOJIS, "🧾"));

// --- Estadísticas (GroupStats.kt). Los reembolsos no cuentan como gasto. ---
const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const keyDate = (k) => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
function statsHtml() {
  const g = S.group, ex = S.expenses.filter((e) => !e.isTransfer);
  if (!ex.length) return '<div class="note">' + tr("no_stats") + "</div>";
  const total = ex.reduce((a, e) => a + e.amountCents, 0);
  const byDay = new Map();
  ex.forEach((e) => { const k = dayKey(e.createdAt); byDay.set(k, (byDay.get(k) || 0) + e.amountCents); });
  const keys = [...byDay.keys()].sort((a, b) => a - b), days = [];
  for (let d = keyDate(keys[0]), last = keyDate(keys[keys.length - 1]); d <= last; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d.getTime()); days.push([k, byDay.get(k) || 0]);
  }
  const per = g.people.map((p) => ({ p, paid: ex.filter((e) => e.payerId === p.id).reduce((a, e) => a + e.amountCents, 0), share: ex.reduce((a, e) => a + (e.shares[p.id] || 0), 0) }))
    .sort((a, b) => b.paid - a.paid);
  const cats = {};
  ex.forEach((e) => { const c = categoryOf(e.title); cats[c] = cats[c] || { cents: 0, n: 0 }; cats[c].cents += e.amountCents; cats[c].n++; });
  const catList = Object.keys(cats).map((c) => [c, cats[c]]).sort((a, b) => b[1].cents - a[1].cents);
  const top = days.filter((d) => d[1] > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3);
  const big = ex.reduce((a, e) => (!a || e.amountCents > a.amountCents ? e : a), null);
  const maxPP = Math.max(1, ...per.map((x) => Math.max(x.paid, x.share))), maxDay = Math.max(1, ...days.map((d) => d[1]));
  const bar = (v, max, cls) => '<span class="bar ' + (cls || "") + '" style="width:' + Math.max(1, Math.round(v * 100 / max)) + '%"></span>';
  const dLong = (k) => keyDate(k).toLocaleDateString(LOC, { weekday: "short", day: "numeric", month: "short" });
  const tile = (v, k) => '<div class="tile"><b>' + v + "</b><small>" + k + "</small></div>";
  return '<div class="tiles">' + tile(money(total), tr("st_total")) + tile(ex.length, tr("st_count")) + tile(money(Math.floor(total / ex.length)), tr("st_avg")) +
      tile(money(g.people.length ? Math.floor(total / g.people.length) : 0), tr("st_pp")) + tile(money(Math.floor(total / days.length)), tr("st_pd", days.length)) + "</div>" +
    "<h2>" + tr("st_people") + '</h2><ul class="bars">' + per.map((x) =>
      '<li><span class="lbl">' + esc(nameYou(x.p.id)) + "</span>" + bar(x.paid, maxPP) + bar(x.share, maxPP, "alt") +
      "<small>" + esc(tr("st_paid_share", money(x.paid), money(x.share))) + "</small></li>").join("") + "</ul>" +
    '<p class="foot"><span class="key"></span> ' + tr("col_paid") + ' · <span class="key alt"></span> ' + tr("col_share") + "</p>" +
    "<h2>" + tr("st_cats") + '</h2><ul class="bars">' + catList.map(([c, v]) =>
      '<li><span class="lbl"><span aria-hidden="true">' + CAT_EMOJI[c] + "</span> " + tr("cat_" + c) + "</span>" + bar(v.cents, catList[0][1].cents) +
      "<small>" + money(v.cents) + " · " + Math.round(v.cents * 100 / total) + " % · " + plural(v.n, "exp_1", "exp_n") + "</small></li>").join("") + "</ul>" +
    (days.length > 1 ? "<h2>" + tr("st_daily") + '</h2><div class="days" role="img" aria-label="' + esc(tr("st_daily") + ": " + days.filter((d) => d[1]).map((d) => dLong(d[0]) + " " + money(d[1])).join(", ")) + '">' +
      days.map((d) => '<span title="' + esc(dLong(d[0]) + " · " + money(d[1])) + '" style="height:' + (d[1] ? Math.max(4, Math.round(d[1] * 100 / maxDay)) : 0) + '%"></span>').join("") + "</div>" : "") +
    "<h2>" + tr("st_days") + '</h2><ol class="plain">' + top.map((d) => "<li><b>" + money(d[1]) + "</b> · " + esc(dLong(d[0])) + "</li>").join("") + "</ol>" +
    "<h2>" + tr("st_big") + '</h2><p class="card"><span aria-hidden="true">' + expenseEmoji(big) + "</span> <b>" + esc(big.title) + "</b> · " + money(big.amountCents) +
      "<br><small>" + esc(tr("paid_by", nameYou(big.payerId))) + " · " + day(big.createdAt) + "</small></p>";
}

// --- Opciones del grupo (menú ⋯) ---
function openMenu() {
  const g = S.group, sheet = $("sheet");
  const items = [["invite", "invite"], ["edit", "m_edit"], ["people", "m_people"], ["rec", "m_recurring"], ["act", "m_activity"], ["csv", "m_csv"], ["share", "m_share_bal"], ["leave", "m_leave"], ["del", "m_delete"]];
  sheet.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="mh"><h2 id="mh">' + esc(tr("menu_h")) + '</h2><div class="list">' +
    items.map(([k, t]) => '<button type="button" data-m="' + k + '"' + (k === "del" || k === "leave" ? ' class="danger"' : "") + '><span class="grow">' + tr(t) + '</span><span class="chev" aria-hidden="true">›</span></button>').join("") +
    '</div><div class="split"><button type="button" id="mclose">' + tr("close") + "</button></div></div>";
  sheet.hidden = false;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  $("mclose").onclick = closeSheet;
  sheet.querySelector("button[data-m]").focus();
  const act = { invite: openInvite, edit: openEditGroup, people: openPeople, rec: openRecurring, act: openActivity, csv: exportCsv, share: shareBalances, leave: leaveGroup, del: deleteGroup };
  sheet.querySelectorAll("[data-m]").forEach((b) => { b.onclick = () => act[b.dataset.m](); });
}
function dlg(title, body, foot) {
  const sheet = $("sheet");
  sheet.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dh"><h2 id="dh">' + esc(title) + "</h2>" + body +
    '<div class="split" style="margin-top:12px">' + (foot || "") + '<button type="button" id="dclose">' + tr("close") + "</button></div></div>";
  sheet.hidden = false;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  $("dclose").onclick = closeSheet;
}

function openEditGroup() {
  const g = S.group, list = CURRENCIES.indexOf(g.currency) >= 0 ? CURRENCIES : [g.currency].concat(CURRENCIES);
  dlg(tr("m_edit"), '<form id="gef" novalidate><label for="gname">' + tr("grp_name") + '</label><input id="gname" maxlength="100" value="' + esc(g.name) + '">' +
    '<label for="gicon">' + tr("g_icon") + '</label><input id="gicon" maxlength="8" autocomplete="off" value="' + esc(g.icon || "") + '" placeholder="🏠"><small>' + tr("g_icon_hint") + "</small>" +
    '<label for="gcur">' + tr("currency") + '</label><select id="gcur">' + list.map((c) => '<option value="' + c + '"' + (c === g.currency ? " selected" : "") + ">" + c + "</option>").join("") + "</select><small>" + tr("g_cur_hint") + "</small>" +
    '<p class="err" id="gerr2" role="alert" style="color:var(--bad)"></p><button type="submit" class="btn on" id="gsave2">' + tr("save") + "</button></form>");
  $("gef").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("gname").value.trim(), icon = $("gicon").value.trim();
    if (!name) { $("gerr2").textContent = tr("e_grp_name"); $("gname").focus(); return; }
    const fields = { name: str(name), currency: str($("gcur").value) };
    if (icon) fields.icon = str(icon);
    const ok = await guarded(() => commit([{ update: { name: groupDoc(), fields }, updateMask: { fieldPaths: ["name", "currency", "icon"] }, currentDocument: { exists: true } }]), $("gsave2"));
    if (ok) { closeSheet(); flash(tr("g_saved")); }
  };
}

// Alguien que ya aparece en algún gasto no se puede quitar sin descuadrar los saldos (isInvolved).
const involved = (pid) => S.expenses.some((e) => e.payerId === pid || pid in e.shares);
function openPeople() {
  const g = S.group;
  dlg(tr("m_people"), '<div class="list">' + g.people.map((p) => {
    const me = p.id === g.me, inv = involved(p.id);
    return '<div class="prow pp"><span class="av" aria-hidden="true">' + initial(p.name) + '</span><span class="grow"><span class="name">' + esc(nameYou(p.id)) + "</span>" +
      (inv ? "<small>" + tr("p_involved") + "</small>" : "") + "</span>" +
      (me ? "" : '<button type="button" data-me="' + p.id + '">' + tr("p_me") + "</button>") +
      (inv ? "" : '<button type="button" class="danger" data-rm="' + p.id + '" aria-label="' + esc(tr("remove_person", p.name)) + '">' + tr("p_remove") + "</button>") + "</div>";
  }).join("") + '</div><form id="padd" class="split" novalidate><input id="pname" maxlength="60" autocomplete="off" placeholder="' + tr("other_ph") + '" aria-label="' + tr("p_add") + '">' +
    '<button type="submit" style="flex:0 0 auto;margin:6px 0">' + tr("add_person") + "</button></form>");
  const sheet = $("sheet");
  sheet.querySelectorAll("[data-me]").forEach((b) => { b.onclick = () => { pickMe(b.dataset.me); closeSheet(); }; });
  sheet.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = async () => {
      const p = g.people.find((x) => x.id === b.dataset.rm);
      if (!p || !confirm(tr("confirm_rm_person", p.name))) return;
      const w = { update: { name: groupDoc(), fields: {} }, updateMask: { fieldPaths: [] }, currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: "people", removeAllFromArray: { values: [mv({ id: int(p.id), name: str(p.name) })] } }] };
      if (p.id === g.me) w.updateMask.fieldPaths.push("who." + tick(S.user.uid));
      if (await guarded(() => commit([w, activityWrite("person_removed", p.name)]))) openPeople();
    };
  });
  $("padd").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("pname").value.trim();
    if (!name) return $("pname").focus();
    if (g.people.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) { $("pname").setAttribute("aria-invalid", "true"); return flash(tr("e_dup")); }
    const add = { update: { name: groupDoc(), fields: {} }, updateMask: { fieldPaths: [] }, currentDocument: { exists: true },
      updateTransforms: [{ fieldPath: "people", appendMissingElements: { values: [mv({ id: int(newId()), name: str(name) })] } }] };
    if (await guarded(() => commit([add, activityWrite("person_added", name)]))) { openPeople(); $("pname").focus(); }
  };
}

function openRecurring() {
  const g = S.group;
  dlg(tr("m_recurring"), "<p>" + tr("rec_hint") + "</p>" + (g.recurring.length ? '<div class="list">' + g.recurring.map((r) =>
    '<div class="prow pp"><span class="grow"><span class="name">' + esc(r.title) + " · " + money(r.amountCents) + "</span><small>" +
      esc(tr("rec_line", nameYou(r.payerId), new Date(r.startAt).getDate())) + '</small></span><button type="button" class="danger" data-stop="' + r.id + '">' + tr("rec_stop") + "</button></div>").join("") + "</div>"
    : '<div class="note">' + tr("rec_none") + "</div>"));
  $("sheet").querySelectorAll("[data-stop]").forEach((b) => {
    b.onclick = async () => {
      const r = g.recurring.find((x) => x.id === b.dataset.stop);
      if (!r || !confirm(tr("rec_stop_q", r.title))) return;
      if (await guarded(() => commit([{ update: { name: groupDoc(), fields: {} }, updateMask: { fieldPaths: ["recurring." + tick(r.id)] }, currentDocument: { exists: true } }]))) openRecurring();
    };
  });
}

async function openActivity() {
  dlg(tr("m_activity"), '<div id="actl"><p>' + tr("loading") + "</p></div>");
  const gid = S.gid;
  try {
    const r = await call(ROOT + "/groups/" + gid + ":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "activity" }], orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: 50,
    } }) });
    if (!r.ok) throw new Error("activity " + r.status);
    const list = (await r.json()).filter((x) => x.document).map((x) => decDoc(x.document));
    if (!$("actl") || S.gid !== gid) return;
    const line = (a) => {
      const by = typeof a.by === "string" && a.by ? a.by : tr("someone"), t = typeof a.title === "string" ? a.title : "", m = money(Number(a.amountCents) || 0);
      return TX["act_" + a.kind] ? tr("act_" + a.kind, by, a.kind === "refund" ? m : t, m) : by + " · " + t;
    };
    $("actl").innerHTML = list.length ? '<ul class="plain act">' + list.map((a) => "<li>" + esc(line(a)) + "<small>" +
      esc(new Date(Number(a.at) || 0).toLocaleString(LOC, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</small></li>").join("") + "</ul>"
      : '<div class="note">' + tr("act_empty") + "</div>";
  } catch (e) { console.warn(e); if ($("actl")) $("actl").innerHTML = '<p class="err" style="color:var(--bad)">' + tr("e_conn") + "</p>"; }
}

// CSV como groupToCsv en la app: una fila por gasto con lo de cada persona y, al final, los saldos.
function exportCsv() {
  const g = S.group, comma = LANG !== "en", sep = comma ? ";" : ",";
  const m = (c) => (c < 0 ? "-" : "") + Math.floor(Math.abs(c) / 100) + (comma ? "," : ".") + String(Math.abs(c) % 100).padStart(2, "0");
  const cell = (t) => {
    t = String(t == null ? "" : t);
    if (t && "=+-@\t\r".indexOf(t[0]) >= 0) t = "'" + t; // que la hoja de cálculo no lo tome por una fórmula
    return t.indexOf(sep) >= 0 || /["\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const iso = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const rows = [[tr("col_date"), tr("col_what"), tr("col_paid"), tr("col_amount") + " (" + g.currency + ")", tr("csv_type"), tr("csv_orig")].concat(g.people.map((p) => p.name))];
  S.expenses.slice().sort((a, b) => a.createdAt - b.createdAt).forEach((e) => rows.push([
    iso(e.createdAt), e.title, personName(e.payerId), m(e.amountCents), e.isTransfer ? tr("refund") : "",
    e.currency && e.originalCents != null && e.rate ? m(e.originalCents) + " " + e.currency + " (1 " + e.currency + " = " + rateString(e.rate) + " " + g.currency + ")" : "",
  ].concat(g.people.map((p) => (p.id in e.shares ? m(e.shares[p.id]) : "")))));
  const bal = balances(g, S.expenses);
  rows.push(["", tr("col_bal"), "", "", "", ""].concat(g.people.map((p) => m(bal[p.id] || 0))));
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(sep)).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = ((g.name || "distro").replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "distro") + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  closeSheet();
}

// Saldos en texto para mandar por WhatsApp, como «Compartir saldos» en la app.
async function shareBalances() {
  const g = S.group, bal = balances(g, S.expenses), spent = S.expenses.filter((e) => !e.isTransfer).reduce((a, e) => a + e.amountCents, 0);
  const ts = settle(bal);
  const text = tr("bal_text_title", g.name, money(spent)) + "\n\n" + g.people.map((p) => p.name + ": " + signed(bal[p.id] || 0)).join("\n") +
    (ts.length ? "\n\n" + tr("to_settle") + "\n" + ts.map((t) => tr("settle_line", personName(t.from), money(t.cents), personName(t.to))).join("\n") : "\n\n" + tr("all_settled"));
  closeSheet();
  if (navigator.share) { try { await navigator.share({ title: g.name, text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(text); flash(tr("bal_copied")); } catch (e) { prompt(tr("m_share_bal"), text); }
}

// Borra los gastos (también los borrados), los tickets y, lo último, el grupo (deleteGroup en la app).
async function deleteGroupDocs(gid) {
  const writes = [];
  for (const sub of ["expenses", "tickets"]) (await listDocs("groups/" + gid + "/" + sub)).forEach((d) => writes.push({ delete: docName("groups/" + gid + "/" + sub + "/" + d.id) }));
  writes.push({ delete: docName("groups/" + gid) });
  await commit(writes);
}
async function leaveGroup() {
  const g = S.group;
  if (!confirm(tr(g.members <= 1 ? "leave_alone_q" : "leave_q", g.name))) return;
  const ok = await guarded(async () => {
    if (g.members <= 1) return deleteGroupDocs(g.id);
    await commit([{ update: { name: groupDoc(), fields: {} }, updateMask: { fieldPaths: ["who." + tick(S.user.uid)] }, currentDocument: { exists: true },
      updateTransforms: [{ fieldPath: "memberUids", removeAllFromArray: { values: [str(S.user.uid)] } }] }]);
  }, null, true);
  if (ok) { closeSheet(); S.groups = null; location.hash = "#/"; flash(tr("left_ok")); }
}
async function deleteGroup() {
  const g = S.group;
  if (!confirm(tr("delete_q", g.name))) return;
  const ok = await guarded(() => deleteGroupDocs(g.id), null, true);
  if (ok) { closeSheet(); S.groups = null; location.hash = "#/"; flash(tr("deleted_g")); }
}

// --- Nuevo grupo (lo mismo que createGroup() en GroupsViewModel: tú primero y quién eres ya elegido) ---
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "MXN", "ARS", "COP", "CLP", "BRL", "SEK", "NOK", "DKK", "PLN", "CZK", "TRY", "MAD", "CNY", "INR"];
// La moneda del país del navegador si es una de la lista (como Fx.defaultCurrency en la app); si no, euros.
function defaultCurrency() {
  const R = { US: "USD", GB: "GBP", CH: "CHF", JP: "JPY", CA: "CAD", AU: "AUD", MX: "MXN", AR: "ARS", CO: "COP", CL: "CLP", BR: "BRL", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", TR: "TRY", MA: "MAD", CN: "CNY", IN: "INR" };
  try { return R[new Intl.Locale(navigator.language || "es").maximize().region] || "EUR"; } catch (e) { return "EUR"; }
}
function homeAdd() {
  const add = $("add");
  add.hidden = false; add.textContent = tr("add_grp"); add.setAttribute("aria-label", tr("add_grp_lbl")); add.onclick = openNewGroup;
}
function openNewGroup() {
  const sheet = $("sheet"), others = [], cur = defaultCurrency();
  const own = (S.user.displayName || "").trim().slice(0, 60);
  sheet.innerHTML = '<form id="grpf" novalidate role="dialog" aria-modal="true" aria-labelledby="gh"><h2 id="gh">' + tr("new_grp") + "</h2>" +
    '<label for="gn">' + tr("grp_name") + '</label><input id="gn" name="group" maxlength="100" placeholder="' + tr("grp_name_ph") + '" autocomplete="off">' +
    '<label for="gm">' + tr("your_name") + '</label><input id="gm" name="name" maxlength="60" autocomplete="name" placeholder="' + tr("name_ph") + '" value="' + esc(own) + '">' +
    '<label for="go">' + tr("others") + '</label><small>' + tr("others_hint") + "</small>" +
    '<div class="split"><input id="go" name="other" maxlength="60" autocomplete="off" placeholder="' + tr("other_ph") + '"><button type="button" id="goadd" style="flex:0 0 auto;margin:6px 0">' + tr("add_person") + "</button></div>" +
    '<div class="chips" id="gol" aria-live="polite"></div>' +
    '<label for="gc">' + tr("currency") + '</label><select id="gc" name="currency">' + CURRENCIES.map((c) => '<option value="' + c + '"' + (c === cur ? " selected" : "") + ">" + c + "</option>").join("") + "</select>" +
    '<p class="err" id="gerr" role="alert" style="color:var(--bad)"></p>' +
    '<div class="split"><button type="button" id="gcancel">' + tr("cancel") + '</button><button type="submit" class="on" id="gsave">' + tr("create") + "</button></div></form>";
  sheet.hidden = false;
  const err = $("gerr");
  const bad = (id, msg) => { err.textContent = msg; const f = $(id); f.setAttribute("aria-invalid", "true"); f.focus(); return false; };
  const taken = (n) => { n = n.toLowerCase(); return n === $("gm").value.trim().toLowerCase() || others.some((o) => o.toLowerCase() === n); };
  const draw = () => {
    $("gol").innerHTML = others.map((n, i) => '<button type="button" aria-pressed="true" data-i="' + i + '" aria-label="' + esc(tr("remove_person", n)) + '">' + esc(n) + ' <span aria-hidden="true">×</span></button>').join("");
  };
  // Añade lo escrito en «Las demás personas»; false si no vale (vacío no cuenta como error).
  const addOther = () => {
    const n = $("go").value.trim();
    if (!n) return true;
    if (taken(n)) return bad("go", tr("e_dup"));
    if (others.length >= 99) return true;
    others.push(n); $("go").value = ""; err.textContent = ""; draw();
    return true;
  };
  $("goadd").onclick = () => { addOther(); $("go").focus(); };
  $("go").onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addOther(); } };
  $("gol").onclick = (ev) => { const b = ev.target.closest("button[data-i]"); if (!b) return; others.splice(Number(b.dataset.i), 1); draw(); $("go").focus(); };
  $("gcancel").onclick = closeSheet;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  if (matchMedia("(pointer: fine)").matches) setTimeout(() => $("gn").focus(), 50);
  ["gn", "gm", "go"].forEach((id) => $(id).addEventListener("input", () => { $(id).removeAttribute("aria-invalid"); err.textContent = ""; }));
  $("grpf").onsubmit = async (ev) => {
    ev.preventDefault();
    const name = $("gn").value.trim(), me = $("gm").value.trim();
    if (!name) return bad("gn", tr("e_grp_name"));
    if (!me) return bad("gm", tr("e_your_name"));
    if (others.some((o) => o.toLowerCase() === me.toLowerCase())) return bad("gm", tr("e_dup"));
    if (!addOther()) return;
    err.textContent = "";
    const people = [me].concat(others).map((n) => ({ id: newId(), name: n }));
    const gid = newId(), btn = $("gsave"), label = btn.textContent;
    btn.disabled = true; btn.textContent = tr("saving");
    try {
      // Las reglas piden que al crearlo solo estés tú en memberUids y en who.
      await commit([{
        update: { name: docName("groups/" + gid), fields: {
          name: str(name), currency: str($("gc").value), createdAt: int(Date.now()),
          people: { arrayValue: { values: people.map((p) => mv({ id: int(p.id), name: str(p.name) })) } },
          memberUids: { arrayValue: { values: [str(S.user.uid)] } },
          who: mv({ [S.user.uid]: int(people[0].id) }),
        } },
        currentDocument: { exists: false },
      }]);
    } catch (e) {
      console.warn(e);
      err.textContent = tr("e_create"); btn.disabled = false; btn.textContent = label;
      return;
    }
    closeSheet();
    S.groups = null;
    go(gid);
    flash(tr("created"));
  };
}

// --- Invitar: un código de 6 caracteres que caduca en 7 días (como createInvite() en la app) ---
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const invites = {}; // grupo → código ya creado en esta visita, para no crear uno nuevo cada vez
async function createInvite(gid, ticket) {
  const key = gid + (ticket ? "/" + ticket : ""), c = invites[key];
  if (c && c.until > Date.now() + 864e5) return c.code;
  for (let tries = 0; ; tries++) {
    const a = new Uint8Array(6); crypto.getRandomValues(a);
    const code = Array.from(a, (x) => CODE_CHARS[x % CODE_CHARS.length]).join(""), now = Date.now(), until = now + 7 * 864e5;
    try {
      await commit([{
        update: { name: docName("invites/" + code), fields: {
          groupId: str(gid), createdAt: { timestampValue: new Date(now).toISOString() }, expiresAt: { timestampValue: new Date(until).toISOString() },
          // Con `ticket` el código solo sirve para entrar como invitado a marcar ese ticket (ver firestore.rules).
          ...(ticket ? { ticket: int(ticket) } : {}),
        } },
        currentDocument: { exists: false }, // si el código ya existe (muy raro), se prueba otro
      }]);
      invites[key] = { code, until };
      return code;
    } catch (e) { if (tries >= 2) throw e; }
  }
}
function openInvite() {
  const g = S.group, sheet = $("sheet");
  sheet.innerHTML = '<form id="invf" role="dialog" aria-modal="true" aria-labelledby="ih"><h2 id="ih">' + esc(tr("invite_to", g.name)) + "</h2>" +
    "<p>" + tr("invite_body") + '</p><div id="invb" aria-live="polite"><p>' + tr("inviting") + "</p></div>" +
    '<div class="split" style="margin-top:10px"><button type="button" id="iclose">' + tr("close") + "</button></div></form>";
  sheet.hidden = false;
  $("iclose").onclick = closeSheet;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  $("invf").onsubmit = (ev) => ev.preventDefault();
  const gid = S.gid;
  createInvite(gid).then((code) => {
    if (S.gid !== gid || !$("invb")) return;
    const url = "https://montarc.es/j/?c=" + code, text = tr("invite_share_text", g.name, url, code);
    const canShare = !!navigator.share;
    $("invb").innerHTML = '<p class="code" translate="no">' + code + "</p>" +
      '<input id="ilink" readonly value="' + esc(url) + '" aria-label="' + tr("copy_link") + '"><small>' + tr("expires_7") + "</small>" +
      '<div class="split" style="margin-top:10px">' + (canShare ? '<button type="button" class="on" id="ishare">' + tr("share") + "</button>" : "") +
      '<button type="button" id="icopy"' + (canShare ? "" : ' class="on"') + ">" + tr("copy_link") + "</button></div>";
    $("ilink").onfocus = () => $("ilink").select();
    $("icopy").onclick = async () => {
      try { await navigator.clipboard.writeText(text); } catch (e) { $("ilink").select(); document.execCommand("copy"); }
      flash(tr("copied"));
    };
    if (canShare) $("ishare").onclick = () => navigator.share({ title: "Distro", text }).catch(() => {});
  }).catch((e) => {
    console.warn(e);
    if (S.gid !== gid || !$("invb")) return;
    $("invb").innerHTML = '<p class="err" role="alert" style="color:var(--bad)">' + tr("e_invite") + '</p><button type="button" id="iretry">' + tr("retry") + "</button>";
    $("iretry").onclick = openInvite;
  });
}

// --- Tickets: leerlos con la cámara y repartirlos (como TicketViewModel y PendingTicket en la app) ---
function toTicket(id, d) {
  if (!isId(id) || !isId(d.payerId)) return null;
  const claims = {}, ids = (a) => (Array.isArray(a) ? a : []).filter(isId);
  Object.keys(d.claims || {}).filter(isId).forEach((k) => {
    const c = d.claims[k] || {}, units = {}, slots = {};
    Object.keys(c.units || {}).filter(isId).forEach((p) => { units[p] = Math.max(0, Math.floor(Number(c.units[p]) || 0)); });
    Object.keys(c.slots || {}).filter(isId).forEach((sl) => { slots[sl] = ids(c.slots[sl]); });
    claims[k] = { units, shared: c.shared === true, sharedBy: ids(c.sharedBy), slots };
  });
  return {
    id, title: d.title || "", payerId: String(d.payerId), createdAt: saneTime(d.createdAt), claims,
    items: (Array.isArray(d.items) ? d.items : []).filter((it) => it && isId(it.id)).map((it) => ({ id: it.id, name: typeof it.name === "string" ? it.name : "", quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)), totalCents: Math.max(0, Math.floor(Number(it.totalCents) || 0)) })),
  };
}
const ticketTotal = (t) => t.items.reduce((a, it) => a + it.totalCents, 0);
// Lo que le toca a cada uno según lo marcado y lo que queda sin marcar (SplitCalculator.compute).
function ticketSplit(t, people) {
  const by = {}; let unassigned = 0;
  people.forEach((p) => { by[p.id] = 0; });
  for (const it of t.items) {
    const a = t.claims[it.id] || { units: {}, shared: false, sharedBy: [], slots: {} };
    if (a.shared) {
      const sh = people.filter((p) => a.sharedBy.indexOf(p.id) >= 0);
      if (!sh.length) { unassigned += it.totalCents; continue; }
      const parts = splitCents(it.totalCents, sh.map(() => 1));
      sh.forEach((p, i) => { by[p.id] += parts[i]; });
      continue;
    }
    const cl = people.filter((p) => (a.units[p.id] || 0) > 0);
    const sl = Object.keys(a.slots).sort(cmpId).map((k) => people.filter((p) => a.slots[k].indexOf(p.id) >= 0)).filter((x) => x.length);
    const claimed = cl.reduce((n, p) => n + a.units[p.id], 0) + sl.length, free = Math.max(0, it.quantity - claimed);
    const parts = splitCents(it.totalCents, cl.map((p) => a.units[p.id]).concat(sl.map(() => 1), [free]));
    cl.forEach((p, i) => { by[p.id] += parts[i]; });
    sl.forEach((ids, k) => { const e = splitCents(parts[cl.length + k], ids.map(() => 1)); ids.forEach((p, i) => { by[p.id] += e[i]; }); });
    unassigned += parts[parts.length - 1];
  }
  return { by, unassigned };
}
// El gasto que queda al cerrarlo: lo que nadie ha marcado se reparte entre todos (PendingTicket.toExpense).
function ticketExpense(t, people) {
  const { by, unassigned } = ticketSplit(t, people), left = splitCents(unassigned, people.map(() => 1)), shares = {};
  people.forEach((p, i) => { const c = (by[p.id] || 0) + left[i]; if (c > 0) shares[p.id] = c; });
  return { id: t.id, title: t.title, payerId: t.payerId, amountCents: ticketTotal(t), shares, createdAt: t.createdAt, isTransfer: false };
}
function unmarked(t, people) {
  const m = new Set();
  Object.values(t.claims).forEach((a) => { Object.keys(a.units).forEach((p) => { if (a.units[p] > 0) m.add(p); }); a.sharedBy.forEach((p) => m.add(p)); Object.values(a.slots).forEach((ids) => ids.forEach((p) => m.add(p))); });
  return people.filter((p) => !m.has(p.id));
}

function ticketsHtml() {
  const people = S.group.people;
  return "<h2>" + tr("pend_h") + "</h2>" + S.tickets.map((t) => {
    const miss = unmarked(t, people);
    return '<section class="card tk" aria-label="' + esc(t.title) + '"><div class="split" style="align-items:baseline"><strong class="grow">' + esc(t.title) + '</strong><span class="amt"><b>' + money(ticketTotal(t)) + "</b></span></div>" +
      "<small>" + esc(tr("pend_meta", nameYou(t.payerId), day(t.createdAt))) + "</small><small>" +
      esc(miss.length ? tr("pend_missing", miss.map((p) => p.name).join(", ")) : tr("pend_all")) + "</small>" +
      '<div class="tkb"><button type="button" class="on" data-tmark="' + t.id + '">' + tr("mark_mine") + '</button><button type="button" data-tshare="' + t.id + '">' + tr("send_link") +
      '</button><button type="button" data-tclose="' + t.id + '">' + tr("close_ticket") + '</button><button type="button" class="link" data-tdel="' + t.id + '">' + tr("delete_ticket") + "</button></div></section>";
  }).join("");
}
function wireTickets() {
  const find = (id) => S.tickets.find((t) => t.id === id);
  document.querySelectorAll("[data-tmark]").forEach((b) => { b.onclick = () => markMine(find(b.dataset.tmark), b); });
  document.querySelectorAll("[data-tshare]").forEach((b) => { b.onclick = () => shareTicket(find(b.dataset.tshare)); });
  document.querySelectorAll("[data-tclose]").forEach((b) => { b.onclick = () => closeTicket(find(b.dataset.tclose), b); });
  document.querySelectorAll("[data-tdel]").forEach((b) => { b.onclick = () => deleteTicket(find(b.dataset.tdel), b); });
}
const ticketUrl = (code, tid) => "https://montarc.es/t/?c=" + code + "&t=" + tid;
// Se marca en /t/, la misma página que usan quienes reciben el enlace.
async function markMine(t, btn) {
  if (!t || S.busy) return;
  const label = btn.textContent; btn.disabled = true; btn.textContent = tr("saving");
  try { const code = await createInvite(S.gid, t.id); location.href = "/t/?c=" + code + "&t=" + t.id; }
  catch (e) { console.warn(e); status(esc(tr("e_invite")), "bad"); btn.disabled = false; btn.textContent = label; }
}
// Hoja con el enlace para compartir (la misma que la de invitar al grupo).
function linkSheet(title, body, makeCode, makeUrl, makeText) {
  const sheet = $("sheet");
  sheet.innerHTML = '<form id="invf" role="dialog" aria-modal="true" aria-labelledby="ih"><h2 id="ih">' + esc(title) + "</h2>" +
    "<p>" + body + '</p><div id="invb" aria-live="polite"><p>' + tr("inviting") + "</p></div>" +
    '<div class="split" style="margin-top:10px"><button type="button" id="iclose">' + tr("close") + "</button></div></form>";
  sheet.hidden = false;
  $("iclose").onclick = closeSheet;
  sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
  $("invf").onsubmit = (ev) => ev.preventDefault();
  const gid = S.gid;
  makeCode().then((code) => {
    if (S.gid !== gid || !$("invb")) return;
    const url = makeUrl(code), text = makeText(url, code), canShare = !!navigator.share;
    $("invb").innerHTML = '<input id="ilink" readonly value="' + esc(url) + '" aria-label="' + tr("copy_link") + '"><small>' + tr("expires_7") + "</small>" +
      '<div class="split" style="margin-top:10px">' + (canShare ? '<button type="button" class="on" id="ishare">' + tr("share") + "</button>" : "") +
      '<button type="button" id="icopy"' + (canShare ? "" : ' class="on"') + ">" + tr("copy_link") + "</button></div>";
    $("ilink").onfocus = () => $("ilink").select();
    $("icopy").onclick = async () => { try { await navigator.clipboard.writeText(text); } catch (e) { $("ilink").select(); document.execCommand("copy"); } flash(tr("copied")); };
    if (canShare) $("ishare").onclick = () => navigator.share({ title: "Distro", text }).catch(() => {});
  }).catch((e) => {
    console.warn(e);
    if (S.gid !== gid || !$("invb")) return;
    $("invb").innerHTML = '<p class="err" role="alert" style="color:var(--bad)">' + tr("e_invite") + "</p>";
  });
}
function shareTicket(t) {
  if (!t) return;
  linkSheet(tr("ticket_link_h", t.title), tr("ticket_link_p"), () => createInvite(S.gid, t.id), (code) => ticketUrl(code, t.id), (url) => tr("ticket_share_text", t.title, url));
}
function closeTicket(t, btn) {
  if (!t) return;
  const people = S.group.people, { unassigned } = ticketSplit(t, people), total = ticketTotal(t);
  if (total <= 0) return;
  if (!confirm(unassigned > 0 ? tr("confirm_close", money(total), money(unassigned)) : tr("confirm_close_all", money(total)))) return;
  const e = ticketExpense(t, people);
  guarded(() => commit([expenseWrite(e), { delete: docName("groups/" + S.gid + "/tickets/" + t.id) }, activityWrite("ticket_closed", t.title, total)]), btn)
    .then((ok) => { if (ok) flash(tr("closed_ok")); });
}
function deleteTicket(t, btn) {
  if (!t || !confirm(tr("confirm_del_ticket", t.title))) return;
  guarded(() => commit([{ delete: docName("groups/" + S.gid + "/tickets/" + t.id) }]), btn);
}

// Fotos → lectura → revisión. Al final se sube como ticket pendiente o se apunta a partes iguales.
let ocrMod = null;
function openScan() {
  const sheet = $("sheet"), photos = [];
  let items = [], printed = null, title = tr("ticket_def");
  const g = S.group, payer0 = g.me && g.people.some((p) => p.id === g.me) ? g.me : (g.people[0] || {}).id;
  let payer = payer0;
  const shell = (body) => {
    sheet.innerHTML = '<form id="scanf" novalidate role="dialog" aria-modal="true" aria-labelledby="sh">' + body + "</form>";
    sheet.hidden = false;
    sheet.onclick = (ev) => { if (ev.target === sheet) closeSheet(); };
    $("scanf").onsubmit = (ev) => ev.preventDefault();
  };
  const freeThumbs = () => photos.forEach((p) => URL.revokeObjectURL(p.url));

  function pick() {
    shell('<h2 id="sh">' + tr("scan_h") + "</h2><p>" + tr("scan_p") + "</p>" +
      '<div class="thumbs">' + photos.map((p, i) => '<span class="th"><img src="' + p.url + '" alt="' + tr("photo_n", i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="' + tr("rm_photo", i + 1) + '">×</button></span>').join("") + "</div>" +
      (photos.length < 5 ? '<input type="file" id="tfile" accept="image/*" multiple class="sr"><label for="tfile" class="btn" role="button" tabindex="0">' + tr("add_photo") + "</label>" : "") +
      (load("ocrLoaded") ? "" : "<small>" + tr("scan_first") + "</small>") +
      '<div class="split" style="margin-top:12px"><button type="button" id="scancel">' + tr("cancel") + '</button><button type="button" class="on" id="sread"' + (photos.length ? "" : " disabled") + ">" + tr("read_btn") + "</button></div>");
    const f = $("tfile");
    if (f) {
      f.onchange = () => { Array.from(f.files || []).slice(0, 5 - photos.length).forEach((file) => photos.push({ file, url: URL.createObjectURL(file) })); pick(); };
      const lb = f.nextElementSibling; lb.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); f.click(); } };
    }
    document.querySelectorAll("[data-rm]").forEach((b) => { b.onclick = () => { const [p] = photos.splice(Number(b.dataset.rm), 1); URL.revokeObjectURL(p.url); pick(); }; });
    $("scancel").onclick = () => { freeThumbs(); closeSheet(); };
    $("sread").onclick = read;
  }

  async function read() {
    shell('<h2 id="sh">' + tr("scan_h") + '</h2><p id="sprog" aria-live="polite">' + tr("ocr_load", "") + '</p><progress id="sbar" max="1" value="0" style="width:100%"></progress>' +
      '<div class="split" style="margin-top:12px"><button type="button" id="scancel">' + tr("cancel") + "</button></div>");
    let cancelled = false;
    $("scancel").onclick = () => { cancelled = true; freeThumbs(); closeSheet(); };
    const pct = (x) => Math.round(x * 100) + " %";
    try {
      ocrMod = ocrMod || await import("./ticket.js");
      const r = await ocrMod.scan(photos.map((p) => p.file), (i, n, frac, phase) => {
        if (cancelled || !$("sprog")) return;
        $("sprog").textContent = phase === "read" ? tr("ocr_read", i + 1, n, pct(frac)) : tr("ocr_load", pct(frac));
        $("sbar").value = phase === "read" ? (i + frac) / n : frac;
      });
      store("ocrLoaded", "1");
      if (cancelled) return;
      items = r.items.map((it) => ({ name: it.name, qty: String(it.quantity), amt: (it.totalCents / 100).toFixed(2).replace(".", LANG === "en" ? "." : ",") }));
      printed = r.printedTotalCents;
      review();
    } catch (e) {
      console.warn(e);
      if (cancelled) return;
      shell('<h2 id="sh">' + tr("scan_h") + '</h2><p class="err" role="alert" style="color:var(--bad)">' + tr("e_ocr") + "</p>" +
        '<div class="split"><button type="button" id="scancel">' + tr("cancel") + '</button><button type="button" class="on" id="sretry">' + tr("retry") + "</button></div>");
      $("scancel").onclick = () => { freeThumbs(); closeSheet(); };
      $("sretry").onclick = read;
    }
  }

  function review() {
    shell('<h2 id="sh">' + tr("review_h") + "</h2><p>" + tr(items.length ? "review_p" : "none_read") + "</p>" +
      '<label for="stitle">' + tr("concept") + '</label><input id="stitle" maxlength="120" autocomplete="off" value="' + esc(title) + '">' +
      '<label for="spayer">' + tr("paid_by_lbl") + '</label><select id="spayer">' + g.people.map((p) => '<option value="' + p.id + '"' + (p.id === payer ? " selected" : "") + ">" + esc(nameYou(p.id)) + "</option>").join("") + "</select>" +
      '<label id="sih">' + tr("items_h") + '</label><div id="sitems" role="group" aria-labelledby="sih">' + items.map((it, i) =>
        '<div class="titem" data-i="' + i + '"><input data-f="name" value="' + esc(it.name) + '" maxlength="120" aria-label="' + tr("item_name", i + 1) + '" autocomplete="off">' +
        '<input data-f="qty" value="' + esc(it.qty) + '" inputmode="numeric" maxlength="3" aria-label="' + tr("item_qty", i + 1) + '" autocomplete="off">' +
        '<input data-f="amt" value="' + esc(it.amt) + '" inputmode="decimal" maxlength="10" aria-label="' + tr("item_amt", i + 1) + '" autocomplete="off">' +
        '<button type="button" data-del="' + i + '" aria-label="' + tr("rm_item", i + 1) + '">×</button></div>').join("") + "</div>" +
      '<button type="button" class="link" id="sadd">' + tr("add_item") + '</button><p id="ssum" aria-live="polite"></p><p class="err" id="serr" role="alert" style="color:var(--bad)"></p>' +
      '<button type="button" class="btn on" id="sup">' + tr("upload") + '</button><button type="button" class="btn" id="seq">' + tr("as_equal") + "</button>" +
      '<div class="split" style="margin-top:10px"><button type="button" id="scancel">' + tr("cancel") + "</button></div>");
    const sum = () => items.reduce((a, it) => a + parseCents(it.amt), 0);
    const upd = () => {
      const c = sum(), n = $("ssum");
      if (printed != null && printed !== c) { n.className = "note warn"; n.textContent = tr("sum_off", money(printed), money(c)); }
      else { n.className = ""; n.textContent = tr("sum_is", money(c)) + (printed != null ? " · " + tr("sum_ok") : ""); }
    };
    upd();
    const keep = () => { title = $("stitle").value; payer = $("spayer").value; };
    $("sitems").oninput = (ev) => { const row = ev.target.closest(".titem"); if (!row) return; items[Number(row.dataset.i)][ev.target.dataset.f] = ev.target.value; ev.target.removeAttribute("aria-invalid"); $("serr").textContent = ""; upd(); };
    $("sitems").onclick = (ev) => { const b = ev.target.closest("[data-del]"); if (!b) return; keep(); items.splice(Number(b.dataset.del), 1); review(); };
    $("sadd").onclick = () => { keep(); items.push({ name: "", qty: "1", amt: "" }); review(); const r = document.querySelectorAll(".titem"); r[r.length - 1].querySelector("input").focus(); };
    $("scancel").onclick = () => { freeThumbs(); closeSheet(); };
    // Los artículos ya revisados, o null (y se marca el campo mal) si alguno no vale.
    const valid = () => {
      keep();
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i], name = it.name.trim(), q = /^\d{1,3}$/.test(it.qty.trim()) ? Number(it.qty.trim()) : 0, c = parseCents(it.amt);
        if (!name && !it.amt.trim()) continue; // fila vacía: se ignora
        const row = document.querySelector('.titem[data-i="' + i + '"]'), badF = !name ? "name" : q < 1 ? "qty" : c <= 0 ? "amt" : null;
        if (badF) { const f = row.querySelector('[data-f="' + badF + '"]'); f.setAttribute("aria-invalid", "true"); f.focus(); $("serr").textContent = tr("e_items"); return null; }
        out.push({ id: out.length, name, quantity: q, totalCents: c });
      }
      if (!out.length) { $("serr").textContent = tr("e_noitems"); return null; }
      return out;
    };
    $("seq").onclick = () => {
      const its = valid(); if (!its) return;
      freeThumbs(); closeSheet();
      openAddExpense({ title: title.trim() || tr("ticket_def"), cents: its.reduce((a, it) => a + it.totalCents, 0), payer });
    };
    $("sup").onclick = async () => {
      const its = valid(); if (!its) return;
      const t = { id: newId(), title: title.trim() || tr("ticket_def"), payerId: payer, createdAt: Date.now(), items: its };
      const ok = await guarded(() => commit([{
        update: { name: docName("groups/" + S.gid + "/tickets/" + t.id), fields: {
          title: str(t.title), payerId: int(t.payerId), createdAt: int(t.createdAt), createdBy: str(S.user.uid),
          items: { arrayValue: { values: its.map((it) => mv({ id: int(it.id), name: str(it.name), quantity: int(it.quantity), totalCents: int(it.totalCents) })) } },
          claims: mv({}),
        } },
        currentDocument: { exists: false },
      }, activityWrite("ticket_uploaded", t.title, its.reduce((a, it) => a + it.totalCents, 0))]), $("sup"));
      if (!ok) { $("serr").textContent = tr("e_save"); return; }
      // Para que la app solo baje los tickets de los grupos que han cambiado; si falla, el ticket ya está.
      commit([{ transform: { document: groupDoc(), fieldTransforms: [{ fieldPath: "lastTicketAt", setToServerValue: "REQUEST_TIME" }] } }]).catch((e) => console.warn(e));
      freeThumbs();
      linkSheet(tr("uploaded_h"), tr("uploaded_p"), () => createInvite(S.gid, t.id), (code) => ticketUrl(code, t.id), (url) => tr("ticket_share_text", t.title, url));
    };
  }
  pick();
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
      // Un enlace con ?c= no mete a nadie en un grupo sin preguntar: quien ya tiene la sesión abierta
      // entraba solo con abrirlo (pentest 2026-11-04, B3).
      if (confirm(tr("join_q", user.email || user.displayName || "?"))) {
        try { const gid = await join(code); if (gid) return go(gid); }
        catch (e) { console.warn(e); status(esc(tr("e_join")), "bad"); }
      }
    }
    route();
  });
})();
