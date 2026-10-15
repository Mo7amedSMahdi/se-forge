// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'validation_problem.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ValidationProblem _$ValidationProblemFromJson(Map<String, dynamic> json) =>
    _ValidationProblem(
      type: json['type'] as String,
      title: json['title'] as String,
      status: (json['status'] as num).toInt(),
      errors: (json['errors'] as List<dynamic>)
          .map((e) => Errors.fromJson(e as Map<String, dynamic>))
          .toList(),
      detail: json['detail'] as String?,
      instance: json['instance'] as String?,
    );

Map<String, dynamic> _$ValidationProblemToJson(_ValidationProblem instance) =>
    <String, dynamic>{
      'type': instance.type,
      'title': instance.title,
      'status': instance.status,
      'errors': instance.errors,
      'detail': instance.detail,
      'instance': instance.instance,
    };
