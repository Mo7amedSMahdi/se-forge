// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/create_user.dart';
import '../models/user.dart';
import '../models/user_page.dart';

part 'users_client.g.dart';

@RestApi()
abstract class UsersClient {
  factory UsersClient(Dio dio, {String? baseUrl}) = _UsersClient;

  /// List users, newest first
  @GET('/v1/users')
  Future<UserPage> listUsers({
    @Query('cursor') String? cursor,
    @Query('limit') int? limit = 20,
  });

  /// Create a user
  @POST('/v1/users')
  Future<User> createUser({@Body() required CreateUser body});

  /// Get one user
  @GET('/v1/users/{userId}')
  Future<User> getUser({@Path('userId') required String userId});
}
