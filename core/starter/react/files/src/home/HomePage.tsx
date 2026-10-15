import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{t('home.title')}</h2>
      <p className="text-muted-foreground">{t('home.intro')}</p>
    </section>
  );
}
