// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'errors.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Errors {

 String get field; String get message;
/// Create a copy of Errors
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ErrorsCopyWith<Errors> get copyWith => _$ErrorsCopyWithImpl<Errors>(this as Errors, _$identity);

  /// Serializes this Errors to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Errors;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Errors&&(identical(other.field, _this.field) || other.field == _this.field)&&(identical(other.message, _this.message) || other.message == _this.message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Errors;
  return Object.hash(runtimeType,_this.field,_this.message);
}

@override
String toString() {
  final _this = this as Errors;
  return 'Errors(field: ${_this.field}, message: ${_this.message})';
}


}

/// @nodoc
abstract mixin class $ErrorsCopyWith<$Res>  {
  factory $ErrorsCopyWith(Errors value, $Res Function(Errors) _then) = _$ErrorsCopyWithImpl;
@useResult
$Res call({
 String field, String message
});




}
/// @nodoc
class _$ErrorsCopyWithImpl<$Res>
    implements $ErrorsCopyWith<$Res> {
  _$ErrorsCopyWithImpl(this._self, this._then);

  final Errors _self;
  final $Res Function(Errors) _then;

/// Create a copy of Errors
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? field = null,Object? message = null,}) {
  return _then(Errors(
field: null == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Errors].
extension ErrorsPatterns on Errors {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Errors value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Errors() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Errors value)  $default,){
final _that = this;
switch (_that) {
case _Errors():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Errors value)?  $default,){
final _that = this;
switch (_that) {
case _Errors() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String field,  String message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Errors() when $default != null:
return $default(_that.field,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String field,  String message)  $default,) {final _that = this;
switch (_that) {
case _Errors():
return $default(_that.field,_that.message);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String field,  String message)?  $default,) {final _that = this;
switch (_that) {
case _Errors() when $default != null:
return $default(_that.field,_that.message);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Errors implements Errors {
  const _Errors({required this.field, required this.message});
  factory _Errors.fromJson(Map<String, dynamic> json) => _$ErrorsFromJson(json);

@override final  String field;
@override final  String message;

/// Create a copy of Errors
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ErrorsCopyWith<_Errors> get copyWith => __$ErrorsCopyWithImpl<_Errors>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ErrorsToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Errors&&(identical(other.field, field) || other.field == field)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,field,message);
}

@override
String toString() {
    return 'Errors(field: $field, message: $message)';
}


}

/// @nodoc
abstract mixin class _$ErrorsCopyWith<$Res> implements $ErrorsCopyWith<$Res> {
  factory _$ErrorsCopyWith(_Errors value, $Res Function(_Errors) _then) = __$ErrorsCopyWithImpl;
@override @useResult
$Res call({
 String field, String message
});




}
/// @nodoc
class __$ErrorsCopyWithImpl<$Res>
    implements _$ErrorsCopyWith<$Res> {
  __$ErrorsCopyWithImpl(this._self, this._then);

  final _Errors _self;
  final $Res Function(_Errors) _then;

/// Create a copy of Errors
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? field = null,Object? message = null,}) {
  return _then(_Errors(
field: null == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
