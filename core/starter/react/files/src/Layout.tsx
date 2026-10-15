import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { languages, type Language } from '@/i18n';

export function Layout() {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-lg font-semibold">{t('app.title')}</h1>
        <label className="flex items-center gap-2 text-sm">
          {t('app.language')}
          <select className="rounded-md border px-2 py-1" value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
            {(Object.keys(languages) as Language[]).map((l) => <option key={l} value={l}>{languages[l].label}</option>)}
          </select>
        </label>
      </header>
      <main className="mx-auto max-w-3xl p-6"><Outlet /></main>
    </div>
  );
}
