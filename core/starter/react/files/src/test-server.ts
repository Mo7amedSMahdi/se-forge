// The API for component tests (msw): every test states the responses it needs.
import { setupServer } from 'msw/node';

export const server = setupServer();
