// The live `mobile` scenario's hidden acceptance test: copied into the pushed branch's mobile/test/ to judge it.
// The status may stand on its own or share a line with the email (the plan says "next to the email").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:users_app/api/export.dart';

import 'test_utils.dart';

void main() {
  // One test per language: a second pumpApp in the same test keeps the first ProviderScope's overrides.
  for (final (lang, active, suspended) in [('en', 'Active', 'Suspended'), ('ar', 'نشط', 'موقوف')]) {
    testWidgets('AC1: each user shows its status ($lang)', (tester) async {
      final client = MockUsersClient();
      final page = UserPage(items: [user(2).copyWith(status: UserStatus.suspended), user(1)], nextCursor: null);
      when(() => client.listUsers(limit: 20)).thenAnswer((_) async => page);
      await pumpApp(tester, client, locale: Locale(lang));
      expect(find.textContaining(suspended), findsOneWidget);
      expect(find.textContaining(active), findsOneWidget);
    });
  }
}
