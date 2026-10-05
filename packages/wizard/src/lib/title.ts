import { useEffect } from 'react';

const SITE = 'Release check-up';
const HOME_DESCRIPTION =
  'Release check-up scans your web app, drafts a test plan and runs real-browser tests. Get a plain-language report on functionality, accessibility, performance, security, SEO, AEO and GEO before you ship.';

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
 * keeps the search- and share-facing tags in step for a client-rendered page: only the home page
 * ('New check-up') is public; every other screen shows a person's own runs and is marked noindex.
 * null leaves the title to a screen further down, which names it itself.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    const isHome = title === 'New check-up';
    document.title = isHome
      ? `${SITE} | Pre-release web app testing: QA, accessibility, SEO, AEO and GEO`
      : title
        ? `${title} \u00B7 ${SITE}`
        : SITE;

    const description = isHome ? HOME_DESCRIPTION : `${title || 'Private screen'} in ${SITE}. This page is private to your machine.`;
    setMeta('meta[name="description"]', metaByName('description'), 'content', description);
    setMeta('meta[name="robots"]', metaByName('robots'), 'content', isHome ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
    setMeta('meta[property="og:title"]', metaByProperty('og:title'), 'content', document.title);
    setMeta('meta[property="og:description"]', metaByProperty('og:description'), 'content', description);

    // The home page's canonical is its own address; private screens point at the home page.
    const canonical = `${window.location.origin}/`;
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonical);
    setMeta('meta[property="og:url"]', metaByProperty('og:url'), 'content', canonical);
  }, [title]);
}
