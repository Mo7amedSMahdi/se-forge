import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import i18n from '@/i18n';
import { server } from './test-server';

// Without Vitest globals, Testing Library cannot register its automatic cleanup: do it here.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => i18n.changeLanguage('en'));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());
