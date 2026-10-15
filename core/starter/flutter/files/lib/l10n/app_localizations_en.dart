// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => '{{title}}';

  @override
  String get language => 'Language';

  @override
  String get loading => 'Loading…';

  @override
  String get error => 'Something went wrong. Try again.';

  @override
  String get homeTitle => 'Welcome';

  @override
  String get homeIntro => 'This is where the first feature goes.';
}
