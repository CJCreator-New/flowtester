import { useEffect } from 'react';

const SITE = 'Release check-up';
/** The landing page's title: the one public screen. */
export const LANDING_TITLE = 'Release check-up';
const HOME_DESCRIPTION =
  'QA without a QA team. Paste your site address and Release check-up scans it, tests it in a real browser and tells you in plain words whether it is ready to release. Free during the beta.';

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string): void {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const metaByName = (name: string) => () => Object.assign(document.createElement('meta'), { name });
const metaByProperty = (property: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute('property', property);
  return el;
};

/**
 * Names the browser tab after the screen, so tabs, history and bookmarks say where they lead. It also
 * keeps the search- and share-facing tags in step for a client-rendered page: only the landing page
 * (LANDING_TITLE) is public; every other screen shows a person's own runs and is marked noindex.
 * null leaves the title to a screen further down, which names it itself.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    const isHome = title === LANDING_TITLE;
    document.title = isHome
      ? `${SITE} | QA without a QA team: know if your site is ready to ship`
      : title
        ? `${title} \u00B7 ${SITE}`
        : SITE;

    const description = isHome ? HOME_DESCRIPTION : `${title || 'Private screen'} in ${SITE}. This page is private to your machine.`;
    setMeta('meta[name="description"]', metaByName('description'), 'content', description);
    setMeta('meta[name="robots"]', metaByName('robots'), 'content', isHome ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
    setMeta('meta[property="og:title"]', metaByProperty('og:title'), 'content', document.title);
    setMeta('meta[property="og:description"]', metaByProperty('og:description'), 'content', description);

    // The landing page's canonical is its own address; private screens point at it too.
    const canonical = `${window.location.origin}/`;
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonical);
    setMeta('meta[property="og:url"]', metaByProperty('og:url'), 'content', canonical);
  }, [title]);
}
