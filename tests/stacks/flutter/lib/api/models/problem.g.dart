// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'problem.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Problem _$ProblemFromJson(Map<String, dynamic> json) => _Problem(
  type: json['type'] as String,
  title: json['title'] as String,
  status: (json['status'] as num).toInt(),
  detail: json['detail'] as String?,
  instance: json['instance'] as String?,
);

Map<String, dynamic> _$ProblemToJson(_Problem instance) => <String, dynamic>{
  'type': instance.type,
  'title': instance.title,
  'status': instance.status,
  'detail': instance.detail,
  'instance': instance.instance,
};
