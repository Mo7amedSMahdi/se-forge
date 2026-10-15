// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'create_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CreateUser {

 String get email; String get displayName;
/// Create a copy of CreateUser
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateUserCopyWith<CreateUser> get copyWith => _$CreateUserCopyWithImpl<CreateUser>(this as CreateUser, _$identity);

  /// Serializes this CreateUser to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CreateUser;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateUser&&(identical(other.email, _this.email) || other.email == _this.email)&&(identical(other.displayName, _this.displayName) || other.displayName == _this.displayName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CreateUser;
  return Object.hash(runtimeType,_this.email,_this.displayName);
}

@override
String toString() {
  final _this = this as CreateUser;
  return 'CreateUser(email: ${_this.email}, displayName: ${_this.displayName})';
}


}

/// @nodoc
abstract mixin class $CreateUserCopyWith<$Res>  {
  factory $CreateUserCopyWith(CreateUser value, $Res Function(CreateUser) _then) = _$CreateUserCopyWithImpl;
@useResult
$Res call({
 String email, String displayName
});




}
/// @nodoc
class _$CreateUserCopyWithImpl<$Res>
    implements $CreateUserCopyWith<$Res> {
  _$CreateUserCopyWithImpl(this._self, this._then);

  final CreateUser _self;
  final $Res Function(CreateUser) _then;

/// Create a copy of CreateUser
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? email = null,Object? displayName = null,}) {
  return _then(CreateUser(
email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateUser].
extension CreateUserPatterns on CreateUser {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateUser value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateUser() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateUser value)  $default,){
final _that = this;
switch (_that) {
case _CreateUser():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateUser value)?  $default,){
final _that = this;
switch (_that) {
case _CreateUser() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String email,  String displayName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateUser() when $default != null:
return $default(_that.email,_that.displayName);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String email,  String displayName)  $default,) {final _that = this;
switch (_that) {
case _CreateUser():
return $default(_that.email,_that.displayName);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String email,  String displayName)?  $default,) {final _that = this;
switch (_that) {
case _CreateUser() when $default != null:
return $default(_that.email,_that.displayName);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateUser implements CreateUser {
  const _CreateUser({required this.email, required this.displayName});
  factory _CreateUser.fromJson(Map<String, dynamic> json) => _$CreateUserFromJson(json);

@override final  String email;
@override final  String displayName;

/// Create a copy of CreateUser
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateUserCopyWith<_CreateUser> get copyWith => __$CreateUserCopyWithImpl<_CreateUser>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateUserToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateUser&&(identical(other.email, email) || other.email == email)&&(identical(other.displayName, displayName) || other.displayName == displayName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,email,displayName);
}

@override
String toString() {
    return 'CreateUser(email: $email, displayName: $displayName)';
}


}

/// @nodoc
abstract mixin class _$CreateUserCopyWith<$Res> implements $CreateUserCopyWith<$Res> {
  factory _$CreateUserCopyWith(_CreateUser value, $Res Function(_CreateUser) _then) = __$CreateUserCopyWithImpl;
@override @useResult
$Res call({
 String email, String displayName
});




}
/// @nodoc
class __$CreateUserCopyWithImpl<$Res>
    implements _$CreateUserCopyWith<$Res> {
  __$CreateUserCopyWithImpl(this._self, this._then);

  final _CreateUser _self;
  final $Res Function(_CreateUser) _then;

/// Create a copy of CreateUser
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? email = null,Object? displayName = null,}) {
  return _then(_CreateUser(
email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
