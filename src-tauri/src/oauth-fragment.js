// Served only on the bounded native loopback callback, with a per-page CSP nonce.
(() => {
  const callback = location.href;
  const target = location.pathname + location.search;
  const secret = document.currentScript.dataset.relay;
  const status = document.getElementById("status");
  const fallback = document.getElementById("fallback");
  try {
    history.replaceState(null, "", target);
  } catch {
    /* still offer manual fallback */
  }
  fetch(target, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "X-Insomnium-OAuth": secret },
    body: callback,
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error("Callback rejected");
      status.textContent =
        "Authorization response received. Return to Insomnium.";
    })
    .catch(() => {
      status.textContent =
        "Could not deliver the callback. Copy this URL into the waiting request’s Auth tab in Insomnium.";
      fallback.value = callback;
      fallback.hidden = false;
    });
})();
