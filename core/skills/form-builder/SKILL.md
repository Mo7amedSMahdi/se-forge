---
name: form-builder
description: Build a form with react-hook-form and zod that matches its contract operation - the same required fields and limits, translated messages, the API's field errors (400) and conflicts (409) on their fields, accessible errors, submit states - with tests for each. Use for any form that sends data to the API.
---

# A form against a contract operation

## Steps
1. **Schema from the contract.** Read the operation's request schema at the pinned version: required fields, types, `minLength`/`maxLength`, formats, enums. Write the zod schema with the same rules (`z.email()`, `.min()`, `.max()`, `z.enum([...])`); messages are translation keys (`errors.required`), translated in every language.
2. **Form**: `useForm({ resolver: zodResolver(schema) })`. Each field gets:
   - a `Label`;
   - an `Input` (or Select, Checkbox) with `aria-invalid` and `aria-describedby` pointing at its error, which has `role="alert"`.

   Disable submit while submitting.
3. **Submit** through the feature's mutation hook (skill `stack-react`); on success, navigate or reset as the acceptance criteria say.
4. **API errors** (the team's problem details):
   - 400: each `errors[].field` goes to `setError(field, { message })`;
   - 409 or 422: to the field the rule is about, with a translated message (e.g. `errors.emailTaken`);
   - anything else: `setError('root')` with a generic translated message.
   Never show raw JSON or stack traces (examples in `stack-react/examples/NewUserPage.tsx`).
5. **Tests** with msw (skill `write-unit-tests`):
   - client-side validation sends no request;
   - each documented 4xx lands on its field;
   - success does what the criteria say;
   - the request body equals what the contract expects.

## Done when
- the zod rules match the contract's request schema, and every message is translated;
- 400 field errors, 409/422 and other failures are shown where the user can act on them;
- the tests cover validation, each documented error status and success.
