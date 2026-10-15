import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderAt } from '@/test-utils';

describe('home', () => {
  it('shows the welcome heading', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome' })).toBeInTheDocument();
  });

  it('sends unknown paths home', async () => {
    const router = renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { level: 2, name: 'Welcome' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});
