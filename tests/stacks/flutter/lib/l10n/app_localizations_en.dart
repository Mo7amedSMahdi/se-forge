// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Users';

  @override
  String get language => 'Language';

  @override
  String get loading => 'Loading…';

  @override
  String get error => 'Something went wrong. Try again.';

  @override
  String get usersTitle => 'Users';

  @override
  String get newUser => 'New user';

  @override
  String get noUsers => 'No users yet.';

  @override
  String get loadMore => 'Load more';

  @override
  String get email => 'Email';

  @override
  String get displayName => 'Name';

  @override
  String get createUser => 'Create user';

  @override
  String get errorEmail => 'Enter a valid email address';

  @override
  String get errorRequired => 'Required';

  @override
  String get errorTooLong => 'Too long';

  @override
  String get errorEmailTaken => 'This email is already used';
}
