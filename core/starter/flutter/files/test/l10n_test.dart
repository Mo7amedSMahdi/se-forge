import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> arb(String lang) =>
    jsonDecode(File('lib/l10n/app_$lang.arb').readAsStringSync())
        as Map<String, Object?>;

void main() {
  test('every language file has the same keys (decision 107)', () {
    Set<String> keys(String lang) =>
        arb(lang).keys.where((k) => !k.startsWith('@')).toSet();
    expect(keys('ar'), keys('en'));
  });
}
