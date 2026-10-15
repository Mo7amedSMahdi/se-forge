import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The API's address, fixed at build time: `--dart-define=API_URL=https://…` (decision 111).
const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:8080',
);

final dioProvider = Provider<Dio>(
  (ref) => Dio(
    BaseOptions(
      baseUrl: apiUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
    ),
  ),
);

// After the first `forge api generate` (the client in lib/api/, decision 103), add next to it:
//   final apiProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(dioProvider)));

/// A problem-details answer (RFC 9457): its status and title, and the field errors of a 400.
class ApiException implements Exception {
  const ApiException(this.status, this.title, [this.errors = const []]);

  final int status;
  final String title;
  final List<({String field, String message})> errors;

  @override
  String toString() => 'ApiException($status, $title)';
}

/// Runs one call; a problem-details answer becomes an [ApiException], anything else is thrown as it was.
Future<T> apiCall<T>(Future<T> Function() request) async {
  try {
    return await request();
  } on DioException catch (e) {
    final data = e.response?.data;
    if (data is Map<String, Object?> && data['status'] is int) {
      final errors = [
        if (data['errors'] case final List<Object?> list)
          for (final item in list.whereType<Map<String, Object?>>())
            if (item['field'] case final String field)
              (
                field: field,
                message: item['message'] is String
                    ? item['message']! as String
                    : '',
              ),
      ];
      throw ApiException(
        data['status']! as int,
        data['title'] is String ? data['title']! as String : '',
        errors,
      );
    }
    rethrow;
  }
}
