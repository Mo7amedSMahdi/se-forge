// The first user flow, on a phone-sized window of the Linux build, headless under Xvfb (decision 109):
//   xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:app/app.dart';

import 'forge_shots.dart';

const _test = 'integration_test/app_test.dart';

Future<void> start(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    const RepaintBoundary(
      key: screenKey,
      child: ProviderScope(child: App()),
    ),
  );
}

/// Pumps until [finder] shows: the API answers in real time, and a spinner never lets pumpAndSettle end.
Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 15),
}) async {
  final end = DateTime.now().add(timeout);
  while (finder.evaluate().isEmpty) {
    if (DateTime.now().isAfter(end)) fail('not shown within $timeout: $finder');
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Pumps frames for [time]: lets a menu or a page finish its animation before the next tap.
Future<void> settle(
  WidgetTester tester, [
  Duration time = const Duration(milliseconds: 600),
]) async {
  for (var t = Duration.zero; t < time; t += const Duration(milliseconds: 50)) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'the app opens in Arabic, right-to-left, and switches to English',
    (tester) async {
      await start(tester);
      await waitFor(tester, find.text('مرحبًا'));
      expect(
        Directionality.of(tester.element(find.text('مرحبًا'))),
        TextDirection.rtl,
      );
      await tester.tap(find.byTooltip('اللغة'));
      await settle(tester);
      await tester.tap(find.text('English'));
      await waitFor(tester, find.text('Welcome'));
      expect(
        Directionality.of(tester.element(find.text('Welcome'))),
        TextDirection.ltr,
      );
      await keepScreen(
        tester,
        'The app opens and switches to English',
        test: _test,
      );
    },
  );
}
