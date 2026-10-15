import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/app.dart';

import 'test_utils.dart';

// The screens as pictures, per language (decision 109). Text shows as boxes in widget tests, so the
// pictures check layout, colours and direction. Make and compare them in the dev container only:
//   docker compose run --rm -T mobile flutter test --update-goldens test/golden_test.dart
void main() {
  for (final lang in ['en', 'ar']) {
    testWidgets('the home screen in $lang', (tester) async {
      await pumpApp(tester, locale: Locale(lang));
      await expectLater(
        find.byType(App),
        matchesGoldenFile('goldens/home_$lang.png'),
      );
    });
  }
}
