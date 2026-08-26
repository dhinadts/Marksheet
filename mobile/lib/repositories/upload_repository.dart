import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

class UploadResult {
  const UploadResult({required this.markSheetId, required this.status});
  final String markSheetId;
  final String status;
}

class UploadRepository {
  UploadRepository(this._dio);
  final Dio _dio;

  Future<UploadResult> upload({
    required String imagePath,
    required Map<String, String> context,
    required String clientRequestId,
  }) async {
    final bytes = await File(imagePath).readAsBytes();
    final checksum = sha256.convert(bytes).toString();
    final lower = imagePath.toLowerCase();
    final mimeType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.heic')
        ? 'image/heic'
        : 'image/jpeg';
    final response = await _dio.post<Map<String, dynamic>>(
      '/mark-sheets/upload-sessions',
      data: {
        'clientRequestId': clientRequestId,
        'studentId': context['Student'],
        'subjectOfferingId': context['Subject offering'],
        'questionPaperVersionId': context['Question paper'],
        'markingSchemeVersionId': context['markingSchemeVersionId'],
        'attempt': 1,
        'pageNumber': 1,
        'mimeType': mimeType,
        'sizeBytes': bytes.length,
        'checksumSha256': checksum,
      },
    );
    final body = response.data!;
    if (body['alreadyCaptured'] == true) {
      // The image may already be in object storage while a previous extraction
      // attempt failed (for example, while the AI service was unavailable).
      // Upload completion is idempotent and resumes extraction for that sheet.
      final markSheetId = body['markSheetId'] as String;
      final completed = await _dio.post<Map<String, dynamic>>(
        '/mark-sheets/$markSheetId/upload-complete',
        options: Options(receiveTimeout: const Duration(seconds: 135)),
      );
      return UploadResult(
        markSheetId: markSheetId,
        status:
            completed.data?['status']?.toString() ??
            body['status']?.toString() ??
            'UPLOADED',
      );
    }
    final upload = body['upload'] as Map<String, dynamic>;
    final uploadHeaders = Map<String, dynamic>.from(upload['headers'] as Map)
      ..[Headers.contentLengthHeader] = bytes.length;
    await Dio().put<void>(
      upload['url'] as String,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: uploadHeaders,
        contentType: mimeType,
        responseType: ResponseType.plain,
      ),
    );
    final completed = await _dio.post<Map<String, dynamic>>(
      '/mark-sheets/${body['markSheetId']}/upload-complete',
      // Upload completion also performs advisory OpenAI vision extraction.
      // Keep this above the backend's 120-second AI timeout so a successful
      // extraction is not mistaken for a failed offline-queue retry.
      options: Options(receiveTimeout: const Duration(seconds: 135)),
    );
    return UploadResult(
      markSheetId: body['markSheetId'] as String,
      status: completed.data?['status']?.toString() ?? 'UPLOADED',
    );
  }
}
