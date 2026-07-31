import "./index.css";
import { createRoot } from "react-dom/client";
import { mountChatPage } from "./pages/Chat/mount";

import pkg from "../package.json" with { type: "json" };

(globalThis as unknown as { __late_react_dom_client__: { createRoot: typeof createRoot } }).__late_react_dom_client__ = { createRoot };

declare global {
  interface Window {
    ChatEngine?: { version: string };
    __lateMicroChatMount?: () => void;
  }
}

// Backwards-compatible handle: the shell may probe ChatEngine before mounting.
window.ChatEngine = { version: pkg.version };

console.info("[micro-chat] v" + pkg.version + " loaded");

// ponytail: one React root for the lifetime of the page, reparented
// between the shell's slot and a detached home.
//
// The shell destroys <div id="micro-chat-root"> when you navigate off
// /irc. We used to mount straight into that div, and mountChatPage's
// unmount closure was discarded, so React kept running on a detached
// node; coming back produced a *fresh* div with no microMounted flag
// and we mounted a SECOND root with a SECOND ChatClient websocket.
// Two sockets for one user means send_to_user fans every offer to
// both, and either one closing evicts the user from their voice room
// server-side (routers/ws.py drops them unconditionally on close).
//
// Reparenting a node does not unmount a React root and does not
// interrupt RTCPeerConnections or the mic, so the call survives
// navigation. That is also the foundation the voice dock needs.
let host: HTMLElement | undefined;

function tryMount() {
  const slot = document.getElementById("micro-chat-root");
  if (!host) {
    if (!slot) return; // nothing to mount into yet
    host = document.createElement("div");
    host.className = "w-full h-full";
    document.body.appendChild(host);
    mountChatPage(host);
  }
  const parent = slot ?? document.body;
  if (host.parentElement !== parent) parent.appendChild(host);
  // Off-route the tree stays mounted (websocket + call alive) but must
  // not paint over the page it is parked on.
  host.style.display = slot ? "" : "none";
}

window.__lateMicroChatMount = tryMount;
tryMount();
if (typeof MutationObserver !== "undefined" && document.body) {
  const obs = new MutationObserver(() => tryMount());
  obs.observe(document.body, { childList: true, subtree: true });
}
