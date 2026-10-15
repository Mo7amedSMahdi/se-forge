import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'users/new_user_page.dart';
import 'users/users_page.dart';

// One route per screen (decision 105). In a provider, so each ProviderScope (each test) gets its own router.
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/users',
    routes: [
      GoRoute(
        path: '/users',
        builder: (context, state) => const UsersPage(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const NewUserPage(),
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
