// Written from the acceptance criteria and the contract (tests/stacks/contract/users.yaml).
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test-server';
import { renderAt } from '@/test-utils';

const user = (n: number) => ({ id: `id-${n}`, email: `u${n}@example.com`, displayName: `User ${n}`, status: 'ACTIVE', createdAt: '2026-10-08T09:00:00Z' });
const problem = (status: number, title: string, extra = {}) => HttpResponse.json({ type: 'about:blank', title, status, ...extra }, { status, headers: { 'Content-Type': 'application/problem+json' } });

describe('users', () => {
  it('lists users and loads the next page with the cursor', async () => {
    server.use(http.get('*/v1/users', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      return HttpResponse.json(cursor === 'c1' ? { items: [user(3)], nextCursor: null } : { items: [user(1), user(2)], nextCursor: 'c1' });
    }));
    renderAt('/users');
    expect(await screen.findByText('User 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('User 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('validates before sending: an invalid email and an empty name', async () => {
    let sent = false;
    server.use(http.post('*/v1/users', () => { sent = true; return HttpResponse.json(user(1), { status: 201 }); }));
    renderAt('/users/new');
    await userEvent.type(await screen.findByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(sent).toBe(false);
  });

  it('shows a 409 on the email field', async () => {
    server.use(http.post('*/v1/users', () => problem(409, 'Email already used')));
    renderAt('/users/new');
    await userEvent.type(await screen.findByLabelText('Email'), 'taken@example.com');
    await userEvent.type(screen.getByLabelText('Name'), 'Amal');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('This email is already used')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('puts the API field errors (400) on their fields', async () => {
    server.use(http.post('*/v1/users', () => problem(400, 'Invalid input', { errors: [{ field: 'displayName', message: 'Too long' }] })));
    renderAt('/users/new');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Name'), 'Amal');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('Too long')).toBeInTheDocument();
  });

  it('creates a user and returns to the list', async () => {
    let created = false;
    server.use(
      http.post('*/v1/users', async ({ request }) => {
        expect(await request.json()).toEqual({ email: 'new@example.com', displayName: 'New' });
        created = true;
        return HttpResponse.json(user(9), { status: 201, headers: { Location: '/v1/users/id-9' } });
      }),
      http.get('*/v1/users', () => HttpResponse.json({ items: created ? [user(9)] : [], nextCursor: null })),
    );
    renderAt('/users/new');
    await userEvent.type(await screen.findByLabelText('Email'), 'new@example.com');
    await userEvent.type(screen.getByLabelText('Name'), 'New');
    await userEvent.click(screen.getByRole('button', { name: 'Create user' }));
    await waitFor(() => expect(screen.getByText('User 9')).toBeInTheDocument());
  });
});
