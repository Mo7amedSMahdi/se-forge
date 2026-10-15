import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../l10n/app_localizations.dart';
import '../layout.dart';
import 'users_providers.dart';

class UsersPage extends ConsumerWidget {
  const UsersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final date = DateFormat.yMMMd(
      Localizations.localeOf(context).toLanguageTag(),
    );
    return AppScaffold(
      title: t.usersTitle,
      action: FloatingActionButton.extended(
        onPressed: () => context.go('/users/new'),
        icon: const Icon(Icons.person_add),
        label: Text(t.newUser),
      ),
      body: switch (ref.watch(usersProvider)) {
        AsyncData(:final value) when value.items.isEmpty => Center(
          child: Text(t.noUsers),
        ),
        AsyncData(:final value) => ListView(
          padding: const EdgeInsetsDirectional.only(bottom: 88),
          children: [
            for (final u in value.items)
              ListTile(
                title: Text(u.displayName),
                subtitle: Text(u.email),
                trailing: Text(date.format(u.createdAt.toUtc())),
              ),
            if (value.nextCursor != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton(
                  onPressed: value.loadingMore
                      ? null
                      : () => _more(context, ref, t),
                  child: Text(t.loadMore),
                ),
              ),
          ],
        ),
        AsyncError() => Center(child: Text(t.error)),
        _ => Center(
          child: CircularProgressIndicator(semanticsLabel: t.loading),
        ),
      },
    );
  }

  Future<void> _more(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations t,
  ) async {
    try {
      await ref.read(usersProvider.notifier).loadMore();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(t.error)));
      }
    }
  }
}
