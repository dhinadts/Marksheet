import '../models/auth_tokens.dart';
import '../providers/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthController extends AsyncNotifier<bool> {
  @override
  Future<bool> build() async =>
      (await ref.read(tokenStoreProvider).read()) != null;
  Future<void> login({
    required String username,
    required String password,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .post<Map<String, dynamic>>(
            '/auth/login',
            data: {
              'username': username.trim(),
              'password': password,
            },
          );
      await ref
          .read(tokenStoreProvider)
          .write(AuthTokens.fromJson(response.data!));
      return true;
    });
  }

  Future<void> logout() async {
    final tokens = await ref.read(tokenStoreProvider).read();
    if (tokens != null) {
      try {
        await ref
            .read(apiClientProvider)
            .dio
            .post<void>(
              '/auth/logout',
              data: {'refreshToken': tokens.refreshToken},
            );
      } catch (_) {
        /* local revocation still occurs */
      }
    }
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(false);
  }

  void sessionExpired() {
    state = const AsyncData(false);
  }
}
