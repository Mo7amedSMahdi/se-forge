import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/export.dart';
import '../core/api.dart';

final usersClientProvider = Provider<UsersClient>(
  (ref) => ref.watch(apiProvider).users,
);

/// The users loaded so far and the cursor of the next page.
class UserList {
  const UserList(this.items, this.nextCursor, {this.loadingMore = false});

  final List<User> items;
  final String? nextCursor;
  final bool loadingMore;
}

/// listUsers, page by page with the API's cursor (decision 104: server state in Riverpod only).
class UsersNotifier extends AsyncNotifier<UserList> {
  static const limit = 20;

  @override
  Future<UserList> build() async {
    final page = await apiCall(
      () => ref.watch(usersClientProvider).listUsers(limit: limit),
    );
    return UserList(page.items, page.nextCursor);
  }

  /// The next page; on a failure the list stays as it was and the error goes to the caller.
  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null || current.loadingMore) {
      return;
    }
    state = AsyncData(
      UserList(current.items, current.nextCursor, loadingMore: true),
    );
    try {
      final page = await apiCall(
        () => ref
            .read(usersClientProvider)
            .listUsers(limit: limit, cursor: current.nextCursor),
      );
      state = AsyncData(
        UserList([...current.items, ...page.items], page.nextCursor),
      );
    } catch (_) {
      state = AsyncData(current);
      rethrow;
    }
  }

  /// createUser; the list loads again after a success. On the notifier, not the screen: its ref
  /// stays valid when the person leaves the screen while the call runs.
  Future<User> create(CreateUser body) async {
    final user = await apiCall(
      () => ref.read(usersClientProvider).createUser(body: body),
    );
    ref.invalidateSelf();
    return user;
  }
}

final usersProvider = AsyncNotifierProvider<UsersNotifier, UserList>(
  UsersNotifier.new,
);
