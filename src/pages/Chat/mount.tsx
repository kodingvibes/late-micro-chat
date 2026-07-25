import { Irc } from "@/pages/Irc/IrcPage";
import { ThemeProvider } from "@/providers/theme-provider";

// Mount helper: the shell renders <div id="micro-chat-root" /> on /irc and
// we drop our own React tree into it. Re-mounts on every route change are cheap.
export function mountChatPage(root: HTMLElement) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ReactDOMClient = (globalThis as any).__late_react_dom_client__;
  if (!ReactDOMClient?.createRoot) {
    root.textContent = "[micro-chat] react-dom/client no disponible";
    return;
  }
  const reactRoot = ReactDOMClient.createRoot(root);
  // ponytail: wrap the chat tree in a ThemeProvider so the
  // surface can flip between light and dark and follow the
  // shell's chosen accent. The provider reads
  // window.LateTheme (set by the shell) and dispatches
  // `late:theme-change` updates.
  reactRoot.render(
    <ThemeProvider>
      <Irc />
    </ThemeProvider>,
  );
  return () => reactRoot.unmount();
}
