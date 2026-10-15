// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'المستخدمون';

  @override
  String get language => 'اللغة';

  @override
  String get loading => 'جارٍ التحميل…';

  @override
  String get error => 'حدث خطأ. حاول مرة أخرى.';

  @override
  String get usersTitle => 'المستخدمون';

  @override
  String get newUser => 'مستخدم جديد';

  @override
  String get noUsers => 'لا يوجد مستخدمون بعد.';

  @override
  String get loadMore => 'عرض المزيد';

  @override
  String get email => 'البريد الإلكتروني';

  @override
  String get displayName => 'الاسم';

  @override
  String get createUser => 'إنشاء المستخدم';

  @override
  String get errorEmail => 'أدخل بريدًا إلكترونيًا صحيحًا';

  @override
  String get errorRequired => 'مطلوب';

  @override
  String get errorTooLong => 'طويل جدًا';

  @override
  String get errorEmailTaken => 'هذا البريد مستخدم من قبل';
}
