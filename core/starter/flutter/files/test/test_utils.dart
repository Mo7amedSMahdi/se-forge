import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:app/app.dart';
import 'package:app/router.dart';
import 'package:app/settings/locale.dart';

/// The real app on a phone-sized screen, the language fixed (English unless [locale] says otherwise),
/// at [path]. No retries: a failure shows at once. Replace the generated client's provider in
/// `overrides` once there is one (skill write-flutter-tests).
Future<ProviderContainer> pumpApp(
  WidgetTester tester, {
  Locale locale = const Locale('en'),
  String path = '/',
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    retry: (_, _) => null,
    overrides: [
      localeProvider.overrideWith(() => _Fixed(locale)),
      ...overrides,
    ],
  );
  addTearDown(container.dispose);
  container.read(routerProvider).go(path);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const App()),
  );
  await tester.pumpAndSettle();
  return container;
}

class _Fixed extends LocaleSetting {
  _Fixed(this.locale);
  final Locale locale;
  @override
  Locale build() => locale;
}
