import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

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

class CapturedMarkSheet {
  const CapturedMarkSheet({
    required this.localId,
    required this.markSheetId,
    required this.status,
    required this.context,
    required this.createdAt,
  });
  final String localId;
  final String markSheetId;
  final String status;
  final Map<String, String> context;
  final DateTime createdAt;
  Map<String, dynamic> toJson() => {
    'localId': localId,
    'markSheetId': markSheetId,
    'status': status,
    'context': context,
    'createdAt': createdAt.toIso8601String(),
  };
  factory CapturedMarkSheet.fromJson(Map<String, dynamic> json) =>
      CapturedMarkSheet(
        localId: json['localId'] as String,
        markSheetId: json['markSheetId'] as String,
        status: json['status'] as String,
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
  static const _historyKey = 'ai_marks_capture_history';
  Future<List<QueuedCapture>> read() async {
    final encoded = await _storage.read(key: _key);
    if (encoded == null) return [];
    return (jsonDecode(encoded) as List<dynamic>)
        .map((item) => QueuedCapture.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<QueuedCapture> enqueue(
    String imagePath,
    Map<String, String> context,
  ) async {
    final entries = await read();
    final now = DateTime.now().toUtc();
    final id = _uuid();
    final directory = Directory(
      '${(await getApplicationDocumentsDirectory()).path}/capture-queue',
    );
    await directory.create(recursive: true);
    final sourceExtension = imagePath.contains('.')
        ? imagePath.split('.').last.toLowerCase()
        : '';
    final extension =
        const {'jpg', 'jpeg', 'png', 'heic'}.contains(sourceExtension)
        ? sourceExtension
        : 'jpg';
    final durablePath = '${directory.path}/$id.$extension';
    await File(imagePath).copy(durablePath);
    final entry = QueuedCapture(
      id: id,
      imagePath: durablePath,
      context: context,
      createdAt: now,
    );
    entries.add(entry);
    await _storage.write(
      key: _key,
      value: jsonEncode(entries.map((item) => item.toJson()).toList()),
    );
    return entry;
  }

  Future<void> remove(String id) async {
    final entries = await read();
    entries.removeWhere((item) => item.id == id);
    await _storage.write(
      key: _key,
      value: jsonEncode(entries.map((item) => item.toJson()).toList()),
    );
  }

  Future<List<CapturedMarkSheet>> readHistory() async {
    final encoded = await _storage.read(key: _historyKey);
    if (encoded == null) return [];
    final decoded = (jsonDecode(encoded) as List<dynamic>)
        .map((item) => CapturedMarkSheet.fromJson(item as Map<String, dynamic>))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    final unique = <String, CapturedMarkSheet>{};
    for (final item in decoded) {
      unique.putIfAbsent(item.markSheetId, () => item);
    }
    return unique.values.toList();
  }

  Future<void> recordUploaded(
    QueuedCapture capture, {
    required String markSheetId,
    required String status,
  }) async {
    final history = await readHistory();
    history.removeWhere(
      (item) =>
          item.localId == capture.id || item.markSheetId == markSheetId,
    );
    history.insert(
      0,
      CapturedMarkSheet(
        localId: capture.id,
        markSheetId: markSheetId,
        status: status,
        context: capture.context,
        createdAt: capture.createdAt,
      ),
    );
    await _storage.write(
      key: _historyKey,
      value: jsonEncode(history.map((item) => item.toJson()).toList()),
    );
  }

  Future<bool> get isOnline async => !(await _connectivity.checkConnectivity())
      .contains(ConnectivityResult.none);

  String _uuid() {
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
