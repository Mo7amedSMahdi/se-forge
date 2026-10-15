import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../layout.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return AppScaffold(
      title: t.homeTitle,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(t.homeIntro, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}
