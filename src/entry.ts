import "./index.css";
import { createRoot } from "react-dom/client";
import { mountChatPage } from "./pages/Chat/mount";

import pkg from "../package.json" with { type: "json" };

(globalThis as unknown as { __late_react_dom_client__: { createRoot: typeof createRoot } }).__late_react_dom_client__ = { createRoot };

declare global {
  interface Window {
    __lateMicroChatMount?: () => void;
  }
}

console.info("[micro-chat] v" + pkg.version + " loaded");

function tryMount() {
  const root = document.getElementById("micro-chat-root");
  if (root && !root.dataset.microMounted) {
    root.dataset.microMounted = "1";
    mountChatPage(root);
  }
}

window.__lateMicroChatMount = tryMount;
tryMount();
if (typeof MutationObserver !== "undefined") {
  const obs = new MutationObserver(() => tryMount());
  obs.observe(document.body, { childList: true, subtree: true });
}
