// Arranque de /g/ que no depende de Firebase: aviso si no carga y registro del service worker.
// Si no carga Firebase (sin conexión o bloqueado), se dice en vez de dejar la página en blanco.
setTimeout(function () {
  if (window.distroReady) return;
  var l = (navigator.language || "en").toLowerCase();
  document.getElementById("skel").hidden = true;
  var n = document.getElementById("status");
  n.className = "note bad";
  n.textContent = l.indexOf("ca") === 0 ? "No s'ha pogut carregar. Revisa la connexió i torna a obrir la pàgina." : l.indexOf("es") === 0 ? "No se ha podido cargar. Revisa tu conexión y vuelve a abrir la página." : "Couldn't load. Check your connection and reopen the page.";
}, 12000);
if ("serviceWorker" in navigator) addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
