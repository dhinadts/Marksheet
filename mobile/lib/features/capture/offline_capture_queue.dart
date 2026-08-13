import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class QueuedCapture {
  const QueuedCapture({
    required this.id,
    required this.imagePath,
    required this.context,
    required this.createdAt,
  });
  final String id;
  final String imagePath;
  final Map<String, String> context;
  final DateTime createdAt;
  Map<String, dynamic> toJson() => {
    'id': id,
    'imagePath': imagePath,
    'context': context,
    'createdAt': createdAt.toIso8601String(),
  };
  factory QueuedCapture.fromJson(Map<String, dynamic> json) => QueuedCapture(
    id: json['id'] as String,
    imagePath: json['imagePath'] as String,
    context: Map<String, String>.from(json['context'] as Map),
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

class OfflineCaptureQueue {
  OfflineCaptureQueue({
    FlutterSecureStorage? storage,
    Connectivity? connectivity,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _connectivity = connectivity ?? Connectivity();
  final FlutterSecureStorage _storage;
  final Connectivity _connectivity;
  static const _key = 'ai_marks_capture_queue';
  Future<List<QueuedCapture>> read() async {
    final encoded = await _storage.read(key: _key);
    if (encoded == null) return [];
    return (jsonDecode(encoded) as List<dynamic>)
        .map((item) => QueuedCapture.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> enqueue(String imagePath, Map<String, String> context) async {
    final entries = await read();
    final now = DateTime.now().toUtc();
    entries.add(
      QueuedCapture(
        id: '${now.microsecondsSinceEpoch}',
        imagePath: imagePath,
        context: context,
        createdAt: now,
      ),
    );
    await _storage.write(
      key: _key,
      value: jsonEncode(entries.map((item) => item.toJson()).toList()),
    );
  }

  Future<void> remove(String id) async {
    final entries = await read();
    entries.removeWhere((item) => item.id == id);
    await _storage.write(
      key: _key,
      value: jsonEncode(entries.map((item) => item.toJson()).toList()),
    );
  }

  Future<bool> get isOnline async => !(await _connectivity.checkConnectivity())
      .contains(ConnectivityResult.none);
}
