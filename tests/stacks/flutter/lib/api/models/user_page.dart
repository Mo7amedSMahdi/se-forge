// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'user.dart';

part 'user_page.freezed.dart';
part 'user_page.g.dart';

@Freezed()
abstract class UserPage with _$UserPage {
  const factory UserPage({
    required List<User> items,
    required String? nextCursor,
  }) = _UserPage;

  factory UserPage.fromJson(Map<String, Object?> json) =>
      _$UserPageFromJson(json);
}
