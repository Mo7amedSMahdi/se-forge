// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'problem.freezed.dart';
part 'problem.g.dart';

@Freezed()
abstract class Problem with _$Problem {
  const factory Problem({
    required String type,
    required String title,
    required int status,
    String? detail,
    String? instance,
  }) = _Problem;

  factory Problem.fromJson(Map<String, Object?> json) =>
      _$ProblemFromJson(json);
}
