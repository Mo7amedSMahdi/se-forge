import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/router.dart';

import 'test_utils.dart';

void main() {
  testWidgets('shows the welcome heading', (tester) async {
    await pumpApp(tester);
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('This is where the first feature goes.'), findsOneWidget);
  });

  testWidgets('sends unknown paths home', (tester) async {
    final app = await pumpApp(tester, path: '/no-such-page');
    expect(find.text('Welcome'), findsOneWidget);
    expect(app.read(routerProvider).state.matchedLocation, '/');
  });

  testWidgets('Arabic lays the screen out right-to-left', (tester) async {
    await pumpApp(tester, locale: const Locale('ar'));
    expect(find.text('مرحبًا'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('مرحبًا'))),
      TextDirection.rtl,
    );
  });
}
