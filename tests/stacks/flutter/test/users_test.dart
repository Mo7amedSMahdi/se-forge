import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:users_app/api/export.dart';

import 'test_utils.dart';

void main() {
  late MockUsersClient client;

  setUpAll(
    () => registerFallbackValue(const CreateUser(email: '', displayName: '')),
  );
  setUp(() => client = MockUsersClient());

  void page(List<User> items, {String? next, String? cursor}) =>
      when(() => client.listUsers(limit: 20, cursor: cursor))
          .thenAnswer((_) async => UserPage(items: items, nextCursor: next));

  testWidgets('lists users, newest first, with their email and date', (
    tester,
  ) async {
    page([user(2), user(1)]);
    await pumpApp(tester, client);
    expect(find.text('User 2'), findsOneWidget);
    expect(find.text('user1@example.com'), findsOneWidget);
    expect(find.text('Oct 2, 2026'), findsOneWidget);
  });

  testWidgets('says so when there are no users', (tester) async {
    page([]);
    await pumpApp(tester, client);
    expect(find.text('No users yet.'), findsOneWidget);
  });

  testWidgets('shows an error when the list cannot load', (tester) async {
    when(() => client.listUsers(limit: 20)).thenThrow(problem(500));
    await pumpApp(tester, client);
    expect(find.text('Something went wrong. Try again.'), findsOneWidget);
  });

  testWidgets('loads the next page with the cursor', (tester) async {
    page([user(3)], next: 'c2');
    page([user(2)], cursor: 'c2');
    await pumpApp(tester, client);
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(find.text('User 2'), findsOneWidget);
    expect(find.text('Load more'), findsNothing);
  });

  testWidgets('Arabic lays the screen out right-to-left', (tester) async {
    page([user(1)]);
    await pumpApp(tester, client, locale: const Locale('ar'));
    expect(find.text('المستخدمون'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('User 1'))),
      TextDirection.rtl,
    );
  });

  group('new user', () {
    Future<void> open(WidgetTester tester) async {
      page([]);
      await pumpApp(tester, client);
      await tester.tap(find.text('New user'));
      await tester.pumpAndSettle();
    }

    Future<void> submit(WidgetTester tester, String email, String name) async {
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Email'),
        email,
      );
      await tester.enterText(find.widgetWithText(TextFormField, 'Name'), name);
      await tester.tap(find.text('Create user'));
      await tester.pumpAndSettle();
    }

    testWidgets('checks the fields like the contract before calling the API', (
      tester,
    ) async {
      await open(tester);
      await submit(tester, 'not-an-email', '   ');
      expect(find.text('Enter a valid email address'), findsOneWidget);
      expect(find.text('Required'), findsOneWidget);
      await submit(tester, 'a@example.com', 'x' * 101);
      expect(find.text('Too long'), findsOneWidget);
      verifyNever(() => client.createUser(body: any(named: 'body')));
    });

    testWidgets('creates the user and goes back to the list, loaded again', (
      tester,
    ) async {
      await open(tester);
      when(() => client.createUser(body: any(named: 'body')))
          .thenAnswer((_) async => user(9));
      page([user(9)]);
      await submit(tester, ' mona@example.com ', 'Mona');
      verify(
        () => client.createUser(
          body: const CreateUser(
            email: 'mona@example.com',
            displayName: 'Mona',
          ),
        ),
      ).called(1);
      expect(find.text('User 9'), findsOneWidget);
    });

    testWidgets('a taken email (409) is shown on the email field', (
      tester,
    ) async {
      await open(tester);
      when(() => client.createUser(body: any(named: 'body')))
          .thenThrow(problem(409));
      await submit(tester, 'taken@example.com', 'Second');
      expect(find.text('This email is already used'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Email'),
        'other@example.com',
      );
      await tester.pump();
      expect(find.text('This email is already used'), findsNothing);
    });

    testWidgets("the API's field errors (400) land on their fields", (
      tester,
    ) async {
      await open(tester);
      when(() => client.createUser(body: any(named: 'body'))).thenThrow(
        problem(
          400,
          errors: [
            {'field': 'displayName', 'message': 'Name is not allowed'},
          ],
        ),
      );
      await submit(tester, 'a@example.com', 'admin');
      expect(find.text('Name is not allowed'), findsOneWidget);
    });

    testWidgets('any other failure is shown under the form', (tester) async {
      await open(tester);
      when(() => client.createUser(body: any(named: 'body')))
          .thenThrow(problem(503));
      await submit(tester, 'a@example.com', 'Mona');
      expect(find.text('Something went wrong. Try again.'), findsOneWidget);
    });
  });
}
