---
name: integrate-api
description: Call an outside service (payment, email, maps, identity, a partner API) from the backend safely - credentials by env name, a typed client, timeouts and retries, errors mapped to ours, and tests that never call the real service. Used by the backend-engineer.
---

# Integrate an outside API

1. **Source**: the provider's OpenAPI spec or official SDK. Generate or install the client: a dependency change asks a person first. A generated client lives in its own generated folder and is never hand-edited.
2. **Credentials** by env variable name only (`<PROVIDER>_API_KEY`), added to `.env.example` with a placeholder. Never read `.env` files, never log keys or tokens, never put them in tests or fixtures.
3. **One adapter** per provider in the infrastructure layer, behind an interface the business code uses. The provider's types stay inside the adapter.
4. **Resilience**:
   - a timeout on every call;
   - retries with backoff only for idempotent calls and for 429 or 5xx responses; respect `Retry-After`;
   - an idempotency key where the provider supports one (payments);
   - the provider's errors mapped to our problem details. Their messages and IDs are logged without personal data and are not passed through to clients.
5. **Webhooks** from the provider: verify the signature, reject replays (timestamp and ID), respond fast, and do the work asynchronously when it is slow. Add them to the plan's threat model.
6. **Tests** never call the real service: test the adapter against a local fake or recorded responses, and the business code against the interface. Outside hosts are refused for agents anyway (`network.allowHosts`).
7. In the plan: the provider, the operations used, the env variables, failure behaviour, and the data sent out (personal data → threat model).

## Done when
- the provider sits behind one adapter, with credentials by env variable name only and a placeholder in `.env.example`;
- every call has a timeout, retries are limited to idempotent calls, and provider errors map to problem details;
- tests use a fake or recorded responses, never the real service; the plan lists the data sent out.
