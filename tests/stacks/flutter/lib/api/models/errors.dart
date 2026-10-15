// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'errors.freezed.dart';
part 'errors.g.dart';

@Freezed()
abstract class Errors with _$Errors {
  const factory Errors({required String field, required String message}) =
      _Errors;

  factory Errors.fromJson(Map<String, Object?> json) => _$ErrorsFromJson(json);
}
