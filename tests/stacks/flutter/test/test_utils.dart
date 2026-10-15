import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:users_app/api/export.dart';
import 'package:users_app/app.dart';
import 'package:users_app/settings/locale.dart';
import 'package:users_app/users/users_providers.dart';

class MockUsersClient extends Mock implements UsersClient {}

User user(int n) => User(
  id: 'u$n',
  email: 'user$n@example.com',
  displayName: 'User $n',
  status: UserStatus.active,
  createdAt: DateTime.utc(2026, 10, n),
);

/// The real app on a phone-sized screen, with the generated client replaced by [client] and the
/// language fixed (English unless [locale] says otherwise). No retries: a failure shows at once.
Future<void> pumpApp(
  WidgetTester tester,
  MockUsersClient client, {
  Locale locale = const Locale('en'),
}) async {
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      retry: (_, _) => null,
      overrides: [
        usersClientProvider.overrideWithValue(client),
        localeProvider.overrideWith(() => _Fixed(locale)),
      ],
      child: const UsersApp(),
    ),
  );
  await tester.pumpAndSettle();
}

class _Fixed extends LocaleSetting {
  _Fixed(this.locale);
  final Locale locale;
  @override
  Locale build() => locale;
}

/// The error the generated client throws for a problem-details answer.
DioException problem(
  int status, {
  List<Map<String, String>> errors = const [],
}) {
  final request = RequestOptions(path: '/v1/users');
  return DioException.badResponse(
    statusCode: status,
    requestOptions: request,
    response: Response(
      requestOptions: request,
      statusCode: status,
      data: {
        'type': 'about:blank',
        'title': 'Problem',
        'status': status,
        if (errors.isNotEmpty) 'errors': errors,
      },
    ),
  );
}
