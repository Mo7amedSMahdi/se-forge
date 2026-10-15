import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/export.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../layout.dart';
import 'users_providers.dart';

class NewUserPage extends ConsumerStatefulWidget {
  const NewUserPage({super.key});

  @override
  ConsumerState<NewUserPage> createState() => _NewUserPageState();
}

class _NewUserPageState extends ConsumerState<NewUserPage> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _name = TextEditingController();
  // The API's own errors, shown on their fields until the field changes (decision 108).
  final _server = <String, String>{};
  String? _error;
  bool _saving = false;

  static final _emailShape = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  @override
  void dispose() {
    _email.dispose();
    _name.dispose();
    super.dispose();
  }

  // The same limits as the contract's CreateUser schema.
  String? _checkEmail(String? v, AppLocalizations t) {
    final s = v?.trim() ?? '';
    if (!_emailShape.hasMatch(s)) return t.errorEmail;
    if (s.length > 254) return t.errorTooLong;
    return null;
  }

  String? _checkName(String? v, AppLocalizations t) {
    final s = v?.trim() ?? '';
    if (s.isEmpty) return t.errorRequired;
    if (s.length > 100) return t.errorTooLong;
    return null;
  }

  Future<void> _submit(AppLocalizations t) async {
    setState(() {
      _server.clear();
      _error = null;
    });
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(usersProvider.notifier)
          .create(
            CreateUser(
              email: _email.text.trim(),
              displayName: _name.text.trim(),
            ),
          );
      if (mounted) context.go('/users');
    } on ApiException catch (e) {
      // A taken email (409) and the API's field errors (400) land on their fields.
      setState(() {
        if (e.status == 409) _server['email'] = t.errorEmailTaken;
        for (final f in e.errors) {
          _server[f.field] = f.message;
        }
        if (_server.isEmpty) _error = t.error;
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return AppScaffold(
      title: t.newUser,
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _email,
              decoration: InputDecoration(labelText: t.email),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              validator: (v) => _checkEmail(v, t),
              forceErrorText: _server['email'],
              onChanged: (_) => setState(() => _server.remove('email')),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              decoration: InputDecoration(labelText: t.displayName),
              textInputAction: TextInputAction.done,
              validator: (v) => _checkName(v, t),
              forceErrorText: _server['displayName'],
              onChanged: (_) => setState(() => _server.remove('displayName')),
              onFieldSubmitted: (_) => _submit(t),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : () => _submit(t),
              child: Text(t.createUser),
            ),
          ],
        ),
      ),
    );
  }
}
