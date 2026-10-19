// Notificaciones push (FCM web) de Distro. ESQUELETO: no-op hasta rellenar APP_ID y VAPID_KEY.
// Al entrar un usuario (unirse a un grupo o volver a la web ya como miembro), pide permiso, obtiene
// el token del navegador y lo guarda en Firestore (pushTokens/{uid}). El ENVÍO lo hace una Cloud
// Function cuando se crea un ticket (ver functions/ en el repo de la app) — requiere el plan Blaze.
const PROJECT = "distro-58a19";
const SENDER_ID = "175085451383";
const WEB_API_KEY = "AIzaSyBGyMSB2-HcDlcOwm9XJ-Qt5k5lcybBgoU";
const APP_ID = "";    // TODO: appId de la app WEB (Consola Firebase > Configuración del proyecto > Tus apps > Web)
const VAPID_KEY = ""; // TODO: clave Web Push (Consola Firebase > Cloud Messaging > Web Push certificates)

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Registra el token de notificaciones de [user] (Firebase User). No-op mientras falte configuración. */
export async function initPush(user) {
  if (!APP_ID || !VAPID_KEY || !user) return;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const { getMessaging, getToken } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js");
    // App aparte ("push") para no chocar con la app por defecto que ya creó app.js.
    const app = initializeApp({ apiKey: WEB_API_KEY, projectId: PROJECT, messagingSenderId: SENDER_ID, appId: APP_ID }, "push");
    const reg = await navigator.serviceWorker.register("/g/firebase-messaging-sw.js");
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token) await storeToken(user, token);
  } catch (e) {
    console.warn("push", e);
  }
}

async function storeToken(user, token) {
  const idToken = await user.getIdToken();
  const url = `${FS}/pushTokens/${user.uid}`
    + "?updateMask.fieldPaths=token&updateMask.fieldPaths=uid&updateMask.fieldPaths=updatedAt";
  const body = { fields: {
    token: { stringValue: token },
    uid: { stringValue: user.uid },
    updatedAt: { timestampValue: new Date().toISOString() },
  } };
  await fetch(url, {
    method: "PATCH",
    headers: { "Authorization": "Bearer " + idToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
