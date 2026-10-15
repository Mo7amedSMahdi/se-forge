// The typed API client, generated from the pinned contract (forge api generate runs openapi-typescript).
// The API is on the same origin under /v1 (proxied by Vite in dev and preview, by Caddy in the image).
import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

// fetch is looked up per call, so test tools that patch it later (msw) are used.
export const api = createClient<paths>({ baseUrl: globalThis.location?.origin ?? '', fetch: (request) => globalThis.fetch(request) });

export type User = components['schemas']['User'];
export type Problem = components['schemas']['Problem'] & { errors?: { field: string; message: string }[] };

// RFC 9457 problem details from the API, as an Error the UI can show and map to form fields.
export class ApiError extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.title);
    this.problem = problem;
  }
}

export function orThrow<T>(r: { data?: T; error?: unknown; response: Response }): T {
  if (r.data !== undefined && r.response.ok) return r.data;
  throw new ApiError((r.error as Problem | undefined) ?? { type: 'about:blank', title: r.response.statusText, status: r.response.status });
}
