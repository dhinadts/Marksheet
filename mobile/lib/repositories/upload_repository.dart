import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

class UploadRepository {
  UploadRepository(this._dio);
  final Dio _dio;

  Future<void> upload({required String imagePath, required Map<String, String> context, required String clientRequestId}) async {
    final bytes = await File(imagePath).readAsBytes();
    final checksum = sha256.convert(bytes).toString();
    final lower = imagePath.toLowerCase();
    final mimeType = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.heic') ? 'image/heic' : 'image/jpeg';
    final response = await _dio.post<Map<String, dynamic>>('/mark-sheets/upload-sessions', data: {
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
    });
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
    await _dio.post<void>('/mark-sheets/${body['markSheetId']}/upload-complete');
  }
}
