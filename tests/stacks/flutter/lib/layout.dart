import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'settings/locale.dart';

/// Every screen's frame: the title and the language menu.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.title,
    required this.body,
    this.action,
  });

  final String title;
  final Widget body;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title), actions: const [LanguageMenu()]),
    body: SafeArea(child: body),
    floatingActionButton: action,
  );
}

class LanguageMenu extends ConsumerWidget {
  const LanguageMenu({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => PopupMenuButton<Locale>(
    tooltip: AppLocalizations.of(context).language,
    icon: const Icon(Icons.translate),
    onSelected: ref.read(localeProvider.notifier).choose,
    itemBuilder: (context) => const [
      PopupMenuItem(value: Locale('ar'), child: Text('العربية')),
      PopupMenuItem(value: Locale('en'), child: Text('English')),
    ],
  );
}
