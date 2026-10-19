// Service worker de notificaciones push (FCM) de Distro web.
// ESQUELETO: no hace nada útil hasta rellenar APP_ID (app WEB registrada en la consola de Firebase).
// Los mensajes con payload de "notification" se muestran solos en segundo plano.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBGyMSB2-HcDlcOwm9XJ-Qt5k5lcybBgoU", // clave pública de la web (restringida a montarc.es)
  projectId: "distro-58a19",
  messagingSenderId: "175085451383",
  appId: "", // TODO: appId de la app WEB (Consola Firebase > Configuración del proyecto > Tus apps > Web)
});

// Con appId puesto, FCM gestiona solo las notificaciones en segundo plano.
if (firebase.app().options.appId) firebase.messaging();
