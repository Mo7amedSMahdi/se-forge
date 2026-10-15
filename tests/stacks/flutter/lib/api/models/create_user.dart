// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_user.freezed.dart';
part 'create_user.g.dart';

@Freezed()
abstract class CreateUser with _$CreateUser {
  const factory CreateUser({
    required String email,
    required String displayName,
  }) = _CreateUser;

  factory CreateUser.fromJson(Map<String, Object?> json) =>
      _$CreateUserFromJson(json);
}
