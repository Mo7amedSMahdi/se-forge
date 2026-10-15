// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'validation_problem.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ValidationProblem {

 String get type; String get title; int get status; List<Errors> get errors; String? get detail; String? get instance;
/// Create a copy of ValidationProblem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ValidationProblemCopyWith<ValidationProblem> get copyWith => _$ValidationProblemCopyWithImpl<ValidationProblem>(this as ValidationProblem, _$identity);

  /// Serializes this ValidationProblem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ValidationProblem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ValidationProblem&&(identical(other.type, _this.type) || other.type == _this.type)&&(identical(other.title, _this.title) || other.title == _this.title)&&(identical(other.status, _this.status) || other.status == _this.status)&&const DeepCollectionEquality().equals(other.errors, _this.errors)&&(identical(other.detail, _this.detail) || other.detail == _this.detail)&&(identical(other.instance, _this.instance) || other.instance == _this.instance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ValidationProblem;
  return Object.hash(runtimeType,_this.type,_this.title,_this.status,const DeepCollectionEquality().hash(_this.errors),_this.detail,_this.instance);
}

@override
String toString() {
  final _this = this as ValidationProblem;
  return 'ValidationProblem(type: ${_this.type}, title: ${_this.title}, status: ${_this.status}, errors: ${_this.errors}, detail: ${_this.detail}, instance: ${_this.instance})';
}


}

/// @nodoc
abstract mixin class $ValidationProblemCopyWith<$Res>  {
  factory $ValidationProblemCopyWith(ValidationProblem value, $Res Function(ValidationProblem) _then) = _$ValidationProblemCopyWithImpl;
@useResult
$Res call({
 String type, String title, int status, List<Errors> errors, String? detail, String? instance
});




}
/// @nodoc
class _$ValidationProblemCopyWithImpl<$Res>
    implements $ValidationProblemCopyWith<$Res> {
  _$ValidationProblemCopyWithImpl(this._self, this._then);

  final ValidationProblem _self;
  final $Res Function(ValidationProblem) _then;

/// Create a copy of ValidationProblem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? type = null,Object? title = null,Object? status = null,Object? errors = null,Object? detail = freezed,Object? instance = freezed,}) {
  return _then(ValidationProblem(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as int,errors: null == errors ? _self.errors : errors // ignore: cast_nullable_to_non_nullable
as List<Errors>,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String?,instance: freezed == instance ? _self.instance : instance // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ValidationProblem].
extension ValidationProblemPatterns on ValidationProblem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ValidationProblem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ValidationProblem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ValidationProblem value)  $default,){
final _that = this;
switch (_that) {
case _ValidationProblem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ValidationProblem value)?  $default,){
final _that = this;
switch (_that) {
case _ValidationProblem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String type,  String title,  int status,  List<Errors> errors,  String? detail,  String? instance)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ValidationProblem() when $default != null:
return $default(_that.type,_that.title,_that.status,_that.errors,_that.detail,_that.instance);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String type,  String title,  int status,  List<Errors> errors,  String? detail,  String? instance)  $default,) {final _that = this;
switch (_that) {
case _ValidationProblem():
return $default(_that.type,_that.title,_that.status,_that.errors,_that.detail,_that.instance);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String type,  String title,  int status,  List<Errors> errors,  String? detail,  String? instance)?  $default,) {final _that = this;
switch (_that) {
case _ValidationProblem() when $default != null:
return $default(_that.type,_that.title,_that.status,_that.errors,_that.detail,_that.instance);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ValidationProblem implements ValidationProblem {
  const _ValidationProblem({required this.type, required this.title, required this.status, required  List<Errors> errors, this.detail, this.instance}): _errors = errors;
  factory _ValidationProblem.fromJson(Map<String, dynamic> json) => _$ValidationProblemFromJson(json);

@override final  String type;
@override final  String title;
@override final  int status;
 final  List<Errors> _errors;
@override List<Errors> get errors {
  if (_errors is EqualUnmodifiableListView) return _errors;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_errors);
}

@override final  String? detail;
@override final  String? instance;

/// Create a copy of ValidationProblem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ValidationProblemCopyWith<_ValidationProblem> get copyWith => __$ValidationProblemCopyWithImpl<_ValidationProblem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ValidationProblemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ValidationProblem&&(identical(other.type, type) || other.type == type)&&(identical(other.title, title) || other.title == title)&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other.errors, _errors)&&(identical(other.detail, detail) || other.detail == detail)&&(identical(other.instance, instance) || other.instance == instance));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,type,title,status,const DeepCollectionEquality().hash(_errors),detail,instance);
}

@override
String toString() {
    return 'ValidationProblem(type: $type, title: $title, status: $status, errors: $errors, detail: $detail, instance: $instance)';
}


}

/// @nodoc
abstract mixin class _$ValidationProblemCopyWith<$Res> implements $ValidationProblemCopyWith<$Res> {
  factory _$ValidationProblemCopyWith(_ValidationProblem value, $Res Function(_ValidationProblem) _then) = __$ValidationProblemCopyWithImpl;
@override @useResult
$Res call({
 String type, String title, int status, List<Errors> errors, String? detail, String? instance
});




}
/// @nodoc
class __$ValidationProblemCopyWithImpl<$Res>
    implements _$ValidationProblemCopyWith<$Res> {
  __$ValidationProblemCopyWithImpl(this._self, this._then);

  final _ValidationProblem _self;
  final $Res Function(_ValidationProblem) _then;

/// Create a copy of ValidationProblem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? type = null,Object? title = null,Object? status = null,Object? errors = null,Object? detail = freezed,Object? instance = freezed,}) {
  return _then(_ValidationProblem(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as int,errors: null == errors ? _self._errors : errors // ignore: cast_nullable_to_non_nullable
as List<Errors>,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String?,instance: freezed == instance ? _self.instance : instance // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
