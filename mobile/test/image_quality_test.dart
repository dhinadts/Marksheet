import 'dart:io';
import 'package:ai_marks_mobile/features/capture/image_quality.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

void main() {
  test('rejects low-resolution captures', () async {
    final directory = await Directory.systemTemp.createTemp(
      'ai-marks-quality-',
    );
    addTearDown(() => directory.delete(recursive: true));
    final file = File('${directory.path}/small.jpg');
    await file.writeAsBytes(img.encodeJpg(img.Image(width: 320, height: 240)));
    final result = await const ImageQualityAnalyzer().analyze(file.path);
    expect(result.acceptable, isFalse);
    expect(result.messages, contains('Resolution is too low'));
  });

  test('rejects undecodable content', () async {
    final directory = await Directory.systemTemp.createTemp(
      'ai-marks-quality-',
    );
    addTearDown(() => directory.delete(recursive: true));
    final file = File('${directory.path}/bad.jpg');
    await file.writeAsString('not an image');
    final result = await const ImageQualityAnalyzer().analyze(file.path);
    expect(result.messages, contains('The image could not be decoded'));
  });
}
