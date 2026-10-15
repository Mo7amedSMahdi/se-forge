import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test-server';
import { renderAt } from '@/test-utils';

describe('languages', () => {
  it('Arabic switches the document to right-to-left and translates the interface', async () => {
    server.use(http.get('*/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })));
    renderAt('/users');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(await screen.findByRole('heading', { level: 1, name: 'المستخدمون' })).toBeInTheDocument();
  });
});
