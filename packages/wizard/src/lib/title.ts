import { useEffect } from 'react';

/**
 * Names the browser tab after the screen, so tabs, history and bookmarks say where they lead.
 * null leaves the title to a screen further down, which names it itself.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    document.title = title ? `${title} · Release check-up` : 'Release check-up';
  }, [title]);
}
