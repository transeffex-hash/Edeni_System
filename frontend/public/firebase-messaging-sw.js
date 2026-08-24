importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBshYvuUv0nVib46XAHdKhLYGXyeUnvYL0",
  authDomain: "edenisystem.firebaseapp.com",
  projectId: "edenisystem",
  storageBucket: "edenisystem.firebasestorage.app",
  messagingSenderId: "464276316292",
  appId: "1:464276316292:web:9d7029c17029f7deb5a2d1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "EdeniSystem", {
    body: body ?? "",
    icon: "/icon-192.png",
    data: payload.data,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? "/";
  event.waitUntil(self.clients.openWindow(link));
});
