// Service Worker مسؤول بس عن استقبال إشعارات Push وعرضها - حتى لو تاب فيورا مقفول خالص.
self.addEventListener("push", (event) => {
  let data = { title: "Viora", body: "" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : "";
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Viora", {
      body: data.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url || "/" },
    })
  );
});

// دوسة على الإشعار بتفتح/تفوكس تاب فيورا (وتوديه لتاب Rooms لو متحدد)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
