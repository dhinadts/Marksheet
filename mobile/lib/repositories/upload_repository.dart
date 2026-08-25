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
    );
    return UploadResult(
      markSheetId: body['markSheetId'] as String,
      status: completed.data?['status']?.toString() ?? 'UPLOADED',
    );
  }
}
