import { Irc } from "@/pages/Irc/IrcPage";

// Mount helper: the shell renders <div id="micro-chat-root" /> on /irc and
// we drop our own React tree into it. Re-mounts on every route change are
// cheap; the ChatEngine singleton (window.ChatEngine) survives.
export function mountChatPage(root: HTMLElement) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ReactDOMClient = (globalThis as any).__late_react_dom_client__;
  if (!ReactDOMClient?.createRoot) {
    root.textContent = "[micro-chat] react-dom/client no disponible";
    return;
  }
  const reactRoot = ReactDOMClient.createRoot(root);
  reactRoot.render(<Irc />);
  return () => reactRoot.unmount();
}
