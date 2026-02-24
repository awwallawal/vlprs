import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
}

function getOrCreateMeta(attr: string, value: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr.includes('property') ? 'property' : 'name', value);
    el.setAttribute('content', '');
    document.head.appendChild(el);
  }
  return el;
}

export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const metaDesc = getOrCreateMeta('name', 'description');
    const prevDesc = metaDesc.getAttribute('content') ?? '';
    metaDesc.setAttribute('content', description);

    const ogTitle = getOrCreateMeta('property', 'og:title');
    const prevOgTitle = ogTitle.getAttribute('content') ?? '';
    ogTitle.setAttribute('content', title);

    const ogDesc = getOrCreateMeta('property', 'og:description');
    const prevOgDesc = ogDesc.getAttribute('content') ?? '';
    ogDesc.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      metaDesc.setAttribute('content', prevDesc);
      ogTitle.setAttribute('content', prevOgTitle);
      ogDesc.setAttribute('content', prevOgDesc);
    };
  }, [title, description]);
}
