---
name: flutter-form
description: Build a form in the Flutter app that matches its contract operation - Form and TextFormField validators with the contract's required fields and limits, translated messages, the API's field errors (400) and conflicts (409) on their fields with forceErrorText, submit states - with widget tests for each. Use for any mobile form that sends data to the API.
---

# A mobile form against a contract operation

Decision 108: Flutter's own `Form`, no form package. The pattern is `stack-flutter/examples/new_user_page.dart`.

## Steps
1. **Rules from the contract.** Read the operation's request schema at the pinned version: the required fields, types, `minLength`/`maxLength`, formats and enums. Write one validator per field with the same rules. Trim text the way the API does. Each message comes from the ARB files, in every language.
2. **Form:** a `ConsumerStatefulWidget` with a `GlobalKey<FormState>` and one `TextEditingController` per field, disposed in `dispose()`. Each field gets:
   - `decoration: InputDecoration(labelText: …)`, which is also how tests and screen readers find it;
   - the right `keyboardType`, `autofillHints` and `textInputAction`;
   - its `validator`;
   - `forceErrorText` for the API's error on that field, cleared in `onChanged`.
   Choices use `DropdownButtonFormField` or `RadioGroup` with the contract's enum values.
3. **Submit:** `validate()` first, then one call through the feature notifier's method (skill `new-screen`). Disable the button while it runs (`onPressed: null`). On success, navigate or reset as the acceptance criteria say; check `mounted` after every `await`.
4. **API errors** (the team's problem details, as `ApiException`):
   - 400: each `errors[].field` goes to that field's `forceErrorText`;
   - 409 or 422: to the field the rule is about, with a translated message (e.g. `errorEmailTaken`);
   - anything else: a translated general message under the form.
   Never show raw JSON or stack traces.
5. **Tests** (skill `write-flutter-tests`), with the client mocked:
   - a field that fails validation sends no request (`verifyNever`);
   - each documented 4xx lands on its field and clears when the field changes;
   - success does what the criteria say;
   - the request body equals what the contract expects (`verify(() => client.op(body: …))`).

## Done when
- the validators repeat the contract's request schema, and every message is in each ARB file;
- 400 field errors, 409/422 and other failures show where the person can act on them;
- the tests cover validation, each documented error status and success.
