// Load test for the users API (decision 77, skill load-test): run in the grafana/k6 container against the
// running Compose stack (`docker compose --profile perf run --rm k6`). Thresholds come from the project's
// non-functional requirements (cite their D-ids); these are the sample's. A failed threshold fails the run.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://api:8080';

export const options = {
  scenarios: {
    // Steady load: 10 users browsing and signing up for 30 s after a 10 s ramp.
    signups: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '10s', target: 10 }, { duration: '30s', target: 10 }], gracefulRampDown: '5s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:list users}': ['p(95)<300'],
    'http_req_duration{name:create user}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const list = http.get(`${BASE}/v1/users?limit=20`, { tags: { name: 'list users' } });
  check(list, { 'list: 200 with items': (r) => r.status === 200 && Array.isArray(r.json('items')) });

  const email = `load-${__VU}-${__ITER}-${Date.now()}@example.com`;
  const created = http.post(`${BASE}/v1/users`, JSON.stringify({ email, displayName: 'Load test' }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create user' },
  });
  check(created, { 'create: 201 with a Location': (r) => r.status === 201 && Boolean(r.headers.Location) });

  sleep(1);
}
