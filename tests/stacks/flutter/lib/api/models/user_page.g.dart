// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_UserPage _$UserPageFromJson(Map<String, dynamic> json) => _UserPage(
  items: (json['items'] as List<dynamic>)
      .map((e) => User.fromJson(e as Map<String, dynamic>))
      .toList(),
  nextCursor: json['nextCursor'] as String?,
);

Map<String, dynamic> _$UserPageToJson(_UserPage instance) => <String, dynamic>{
  'items': instance.items,
  'nextCursor': instance.nextCursor,
};
