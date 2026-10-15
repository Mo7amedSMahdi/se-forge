// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'errors.dart';

part 'validation_problem.freezed.dart';
part 'validation_problem.g.dart';

@Freezed()
abstract class ValidationProblem with _$ValidationProblem {
  const factory ValidationProblem({
    required String type,
    required String title,
    required int status,
    required List<Errors> errors,
    String? detail,
    String? instance,
  }) = _ValidationProblem;

  factory ValidationProblem.fromJson(Map<String, Object?> json) =>
      _$ValidationProblemFromJson(json);
}
