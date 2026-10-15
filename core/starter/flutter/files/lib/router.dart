import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'home/home_page.dart';

// One route per screen (decision 105). In a provider, so each ProviderScope (each test) gets its own
// router. A path the app does not know goes home.
final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [GoRoute(path: '/', builder: (context, state) => const HomePage())],
    onException: (context, state, router) => router.go('/'),
  );
  ref.onDispose(router.dispose);
  return router;
});
