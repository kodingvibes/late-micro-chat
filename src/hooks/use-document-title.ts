// ponytail: minimal document-title hook for the chat micro. The shell has
// its own useDocumentTitle that depends on react-router-dom; we don't need
// route-awareness here because the micro only renders on /irc.
import { useEffect } from "react";

const DEFAULT_TITLE = "chat · late.kodingvibes.com";

export function useDocumentTitle(fallback: string = DEFAULT_TITLE) {
  useEffect(() => {
    const original = document.title;
    document.title = fallback;
    return () => { document.title = original; };
  }, [fallback]);
}

export default useDocumentTitle;
