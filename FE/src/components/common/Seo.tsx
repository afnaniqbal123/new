import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SeoProps {
  title: string;
  description?: string;
}

/** Sets `document.title` (and the description meta tag) per route. No visible output. */
export function Seo({ title, description }: SeoProps) {
  const { t } = useTranslation();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · ${t('APP_NAME')}`;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [title, description, t]);

  return null;
}
