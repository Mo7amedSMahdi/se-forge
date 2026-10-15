import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:users_app/api/export.dart';
import 'package:users_app/app.dart';

import 'test_utils.dart';

// The screens as pictures, per language (decision 109). Text shows as boxes in widget tests, so the
// pictures check layout, colours and direction. Make and compare them in the dev container only:
//   flutter test --update-goldens test/golden_test.dart
void main() {
  for (final lang in ['en', 'ar']) {
    testWidgets('the users list in $lang', (tester) async {
      final client = MockUsersClient();
      when(() => client.listUsers(limit: 20)).thenAnswer(
        (_) async => UserPage(items: [user(2), user(1)], nextCursor: 'c2'),
      );
      await pumpApp(tester, client, locale: Locale(lang));
      await expectLater(
        find.byType(UsersApp),
        matchesGoldenFile('goldens/users_$lang.png'),
      );
    });
  }
}
