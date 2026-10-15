import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsers } from './api';

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const users = useUsers(20);
  const items = users.data?.pages.flatMap((p) => p.items) ?? [];
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('users.title')}</CardTitle>
        <Button asChild><Link to="/users/new">{t('users.new')}</Link></Button>
      </CardHeader>
      <CardContent>
        {users.isPending && <p role="status">{t('common.loading')}</p>}
        {users.isError && <p role="alert">{t('common.error')}</p>}
        {users.isSuccess && items.length === 0 && <p>{t('users.empty')}</p>}
        <ul className="divide-y">
          {items.map((u) => (
            <li key={u.id} className="flex justify-between gap-4 py-2 text-start">
              <span>{u.displayName} <span className="text-muted-foreground ms-2">{u.email}</span></span>
              <time dateTime={u.createdAt}>{date.format(new Date(u.createdAt))}</time>
            </li>
          ))}
        </ul>
        {users.hasNextPage && (
          <Button variant="outline" className="mt-4" disabled={users.isFetchingNextPage} onClick={() => users.fetchNextPage()}>
            {t('users.more')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
