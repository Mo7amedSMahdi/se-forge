// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => '{{title}}';

  @override
  String get language => 'اللغة';

  @override
  String get loading => 'جارٍ التحميل…';

  @override
  String get error => 'حدث خطأ. حاول مرة أخرى.';

  @override
  String get homeTitle => 'مرحبًا';

  @override
  String get homeIntro => 'هنا تبدأ أول ميزة.';
}
