// User flows from the acceptance criteria, against the real API (the FastAPI sample on PostgreSQL), on
// a phone-sized window of the Linux desktop build, headless under Xvfb (decision 109):
//   xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:users_app/app.dart';
import 'package:users_app/core/api.dart';

import 'forge_shots.dart';

const _test = 'integration_test/users_test.dart';

String email(String tag) =>
    '$tag-${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 20)}@example.com';

Future<void> start(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    const RepaintBoundary(
      key: screenKey,
      child: ProviderScope(child: UsersApp()),
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

Future<void> chooseEnglish(WidgetTester tester) async {
  await tester.tap(find.byTooltip('اللغة'));
  await settle(tester);
  await tester.tap(find.text('English'));
  await waitFor(tester, find.text('New user'));
  await settle(tester);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'a new user appears in the list (Arabic by default, right-to-left)',
    (tester) async {
      await start(tester);
      await waitFor(tester, find.text('مستخدم جديد'));
      expect(
        Directionality.of(tester.element(find.text('مستخدم جديد'))),
        TextDirection.rtl,
      );
      await chooseEnglish(tester);
      expect(
        Directionality.of(tester.element(find.text('New user'))),
        TextDirection.ltr,
      );
      await tester.tap(find.text('New user'));
      await waitFor(tester, find.text('Create user'));
      final address = email('it');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Email'),
        address,
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Name'),
        'Flutter User',
      );
      await tester.tap(find.text('Create user'));
      await waitFor(tester, find.widgetWithText(ListTile, address));
      await keepScreen(tester, 'A new user appears in the list', test: _test);
    },
  );

  testWidgets('a taken email is shown on the email field', (tester) async {
    final address = email('taken');
    final created = await Dio(BaseOptions(baseUrl: apiUrl)).post<Object?>(
      '/v1/users',
      data: {'email': address, 'displayName': 'First'},
    );
    expect(created.statusCode, 201);
    await start(tester);
    await waitFor(tester, find.text('مستخدم جديد'));
    await chooseEnglish(tester);
    await tester.tap(find.text('New user'));
    await waitFor(tester, find.text('Create user'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email'),
      address,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Name'),
      'Second',
    );
    await tester.tap(find.text('Create user'));
    await waitFor(tester, find.text('This email is already used'));
    await keepScreen(
      tester,
      'A taken email is shown on the email field',
      test: _test,
    );
  });
}
