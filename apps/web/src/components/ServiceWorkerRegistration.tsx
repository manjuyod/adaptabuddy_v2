"use client";

import { useEffect } from "react";

const postSkipWaiting = (worker: ServiceWorker | null | undefined) => {
  worker?.postMessage({ type: "SKIP_WAITING" });
};

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const shouldRegister =
      process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (!shouldRegister) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ("caches" in window) {
        void window.caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("adaptabuddy-"))
            .forEach((key) => {
              void window.caches.delete(key);
            });
        });
      }

      return;
    }

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        postSkipWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              postSkipWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        // Keep failures non-fatal and avoid impacting app bootstrap.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
