import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The app's language: Arabic first (decision 107), changed from the language menu.
class LocaleSetting extends Notifier<Locale> {
  @override
  Locale build() => const Locale('ar');

  void choose(Locale locale) => state = locale;
}

final localeProvider = NotifierProvider<LocaleSetting, Locale>(
  LocaleSetting.new,
);
