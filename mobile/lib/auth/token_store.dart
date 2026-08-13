import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/auth_tokens.dart';

class TokenStore {
  TokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  static const _key = 'ai_marks_auth_tokens';
  Future<AuthTokens?> read() async {
    final value = await _storage.read(key: _key);
    return value == null
        ? null
        : AuthTokens.fromJson(jsonDecode(value) as Map<String, dynamic>);
  }

  Future<void> write(AuthTokens tokens) =>
      _storage.write(key: _key, value: jsonEncode(tokens.toJson()));
  Future<void> clear() => _storage.delete(key: _key);
}
