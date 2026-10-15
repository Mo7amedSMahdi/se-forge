import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateUser } from './api';

// The same limits as the contract's CreateUser schema; messages are translation keys.
const schema = z.object({
  email: z.email('errors.email').max(254, 'errors.tooLong'),
  displayName: z.string().trim().min(1, 'errors.required').max(100, 'errors.tooLong'),
});
type Form = z.infer<typeof schema>;

export function NewUserPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateUser();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      navigate('/users');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      // The API's field errors (400) and the duplicate email (409) land on their fields.
      if (e.problem.status === 409) setError('email', { message: 'errors.emailTaken' });
      for (const fe of e.problem.errors ?? []) {
        if (fe.field === 'email' || fe.field === 'displayName') setError(fe.field, { message: fe.message });
      }
      if (e.problem.status !== 409 && !e.problem.errors?.length) setError('root', { message: 'common.error' });
    }
  });

  const field = (name: keyof Form, label: string, type = 'text') => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} aria-invalid={!!errors[name]} aria-describedby={`${name}-error`} {...register(name)} />
      {errors[name] && <p id={`${name}-error`} role="alert" className="text-destructive text-sm">{t(errors[name]?.message ?? '')}</p>}
    </div>
  );

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>{t('users.new')}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {field('email', t('users.email'), 'email')}
          {field('displayName', t('users.displayName'))}
          {errors.root && <p role="alert" className="text-destructive text-sm">{t(errors.root.message ?? '')}</p>}
          <Button type="submit" disabled={isSubmitting}>{t('users.create')}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
