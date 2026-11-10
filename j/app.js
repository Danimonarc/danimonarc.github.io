// Página de una invitación (montarc.es/j/): botones para abrir la app o entrar desde el navegador.
var TX = {
  "title": {"es": "Invitación a Distro", "en": "Distro invitation", "ca": "Invitació a Distro"},
  "h1": {"es": "Te han invitado a un grupo", "en": "You've been invited to a group", "ca": "T'han convidat a un grup"},
  "sub": {"es": "Reparte los gastos con tus amigos en <strong>Distro</strong>.", "en": "Split expenses with your friends on <strong>Distro</strong>.", "ca": "Reparteix les despeses amb els amics a <strong>Distro</strong>."},
  "open": {"es": "Abrir en Distro", "en": "Open in Distro", "ca": "Obrir a Distro"},
  "play": {"es": "Descargar en Google Play", "en": "Get it on Google Play", "ca": "Descarregar a Google Play"},
  "android_hint": {"es": "¿Aún no la tienes? Descárgala, ábrela, pulsa «Unirse con código» y escribe este código.", "en": "Don't have it yet? Download it, open it, tap “Join with a code” and enter this code.", "ca": "Encara no la tens? Descarrega-la, obre-la, prem «Unir-se amb codi» i escriu aquest codi."},
  "or_web": {"es": "o, sin instalar nada:", "en": "or, without installing anything:", "ca": "o, sense instal·lar res:"},
  "web": {"es": "Entrar desde el navegador", "en": "Join from the browser", "ca": "Entrar des del navegador"},
  "ios_hint": {"es": "En iPhone no hace falta instalar nada: Distro funciona desde Safari.", "en": "No need to install anything on iPhone: Distro works in Safari.", "ca": "A l'iPhone no cal instal·lar res: Distro funciona des de Safari."},
  "inapp": {"es": "Lo has abierto dentro de otra app. Ábrelo en Safari (menú ··· → «Abrir en Safari») para que no se pierda la sesión y puedas añadirlo a la pantalla de inicio.", "en": "You opened this inside another app. Open it in Safari (··· menu → “Open in Safari”) so your session is kept and you can add it to your Home Screen.", "ca": "L'has obert dins d'una altra app. Obre-ho a Safari (menú ··· → «Obrir a Safari») perquè no es perdi la sessió i puguis afegir-ho a la pantalla d'inici."},
  "howto": {"es": "📲 Tenerla como una app en el iPhone", "en": "📲 Keep it like an app on your iPhone", "ca": "📲 Tenir-la com una app a l'iPhone"},
  "step1": {"es": "Abre esta página en <b>Safari</b>. Si la abriste desde WhatsApp, pulsa «Abrir en Safari».", "en": "Open this page in <b>Safari</b>. If you opened it from WhatsApp, tap “Open in Safari”.", "ca": "Obre aquesta pàgina a <b>Safari</b>. Si l'has obert des de WhatsApp, prem «Obrir a Safari»."},
  "step2": {"es": "Entra en el grupo con «Entrar desde el navegador».", "en": "Join the group with “Join from the browser”.", "ca": "Entra al grup amb «Entrar des del navegador»."},
  "step3": {"es": "Pulsa el botón <b>Compartir</b> {icon} (abajo en el iPhone, arriba en el iPad).", "en": "Tap the <b>Share</b> button {icon} (at the bottom on iPhone, at the top on iPad).", "ca": "Prem el botó <b>Compartir</b> {icon} (a baix a l'iPhone, a dalt a l'iPad)."},
  "step4": {"es": "Baja y pulsa <b>«Añadir a pantalla de inicio»</b> y luego <b>«Añadir»</b>.", "en": "Scroll down, tap <b>“Add to Home Screen”</b> and then <b>“Add”</b>.", "ca": "Baixa i prem <b>«Afegir a la pantalla d'inici»</b> i després <b>«Afegir»</b>."},
  "step5": {"es": "Ya tienes el icono de Distro: ábrelo desde ahí para ver tus grupos.", "en": "Now you have the Distro icon: open it from there to see your groups.", "ca": "Ja tens la icona de Distro: obre-la des d'allà per veure els teus grups."},
  "copy": {"es": "Copiar código", "en": "Copy code", "ca": "Copiar el codi"},
  "copied": {"es": "Copiado ✓", "en": "Copied ✓", "ca": "Copiat ✓"},
  "hold": {"es": "Mantén pulsado el código para copiarlo", "en": "Press and hold the code to copy it", "ca": "Mantén premut el codi per copiar-lo"},
  "expires": {"es": "El código caduca a los 7 días de crearlo.", "en": "The code expires 7 days after it was created.", "ca": "El codi caduca 7 dies després de crear-lo."},
  "bad": {"es": "Este enlace no es válido. Pídele a quien te invitó que te mande otro.", "en": "This link isn't valid. Ask whoever invited you to send another one.", "ca": "Aquest enllaç no és vàlid. Demana a qui t'ha convidat que te n'enviï un altre."}
};
var $ = function (id) { return document.getElementById(id); };
var params = new URLSearchParams(location.search);
var L = (function (l) { l = l.toLowerCase(); return l.indexOf("ca") === 0 ? "ca" : l.indexOf("es") === 0 ? "es" : "en"; })(params.get("lang") || navigator.language || "en");
function tr(k) { return TX[k][L]; }
document.documentElement.lang = L; document.title = tr("title");
[].forEach.call(document.querySelectorAll("[data-tr]"), function (n) { n.textContent = tr(n.getAttribute("data-tr")); });
[].forEach.call(document.querySelectorAll("[data-trh]"), function (n) {
  var icon = n.querySelector("svg");
  n.innerHTML = tr(n.getAttribute("data-trh")).replace("{icon}", icon ? icon.outerHTML : "");
});

var ua = navigator.userAgent;
// iPadOS se presenta como Mac: se reconoce por la pantalla táctil.
var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
var android = /Android/i.test(ua);
var code = (params.get("c") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

if (code.length === 6) {
  $("ok").hidden = false;
  $("code").textContent = code;
  $("open").href = "distro://j?c=" + code;
  $("web").href = "/g/?c=" + code;
  if (android) {
    $("android").hidden = false;
    $("web").className = "btn ghost";
  } else {
    $("web").className = "btn primary";
    if (ios) {
      $("ios").hidden = false;
      // Navegadores dentro de otras apps (Instagram, Facebook, Line, Google…): ahí no se puede añadir a inicio.
      $("inapp").hidden = !/FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|TikTok|musical_ly/i.test(ua);
    } else {
      $("playother").hidden = false;
    }
  }
  $("copy").onclick = function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
      .then(function () { b.textContent = tr("copied"); })
      .catch(function () { b.textContent = tr("hold"); });
  };
} else {
  $("bad").hidden = false;
}
