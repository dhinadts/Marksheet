import 'package:dio/dio.dart';
import '../auth/token_store.dart';
import '../config/app_config.dart';
import '../models/auth_tokens.dart';

class ApiClient {
  ApiClient(this._tokens, {Dio? dio})
    : dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
            ),
          ) {
    this.dio.interceptors.add(
      InterceptorsWrapper(onRequest: _authorize, onError: _refresh),
    );
  }
  final TokenStore _tokens;
  final Dio dio;
  bool _refreshing = false;
  Future<void> _authorize(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final tokens = await _tokens.read();
    if (tokens != null) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  Future<void> _refresh(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    if (error.response?.statusCode != 401 ||
        error.requestOptions.extra['retried'] == true ||
        _refreshing) {
      return handler.next(error);
    }
    final tokens = await _tokens.read();
    if (tokens == null) return handler.next(error);
    _refreshing = true;
    try {
      final response = await Dio(BaseOptions(baseUrl: dio.options.baseUrl))
          .post<Map<String, dynamic>>(
            '/auth/refresh',
            data: {'refreshToken': tokens.refreshToken},
          );
      final rotated = AuthTokens.fromJson(response.data!);
      await _tokens.write(rotated);
      final request = error.requestOptions..extra['retried'] = true;
      request.headers['Authorization'] = 'Bearer ${rotated.accessToken}';
      handler.resolve(await dio.fetch<dynamic>(request));
    } catch (_) {
      await _tokens.clear();
      handler.next(error);
    } finally {
      _refreshing = false;
    }
  }
}
