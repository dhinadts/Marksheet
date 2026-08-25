import 'dart:io';
import 'package:ai_marks_mobile/features/capture/image_quality.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

void main() {
  test('accepts a decodable sheet regardless of resolution', () async {
    final directory = await Directory.systemTemp.createTemp(
      'ai-marks-quality-',
    );
    addTearDown(() => directory.delete(recursive: true));
    final file = File('${directory.path}/small.jpg');
    final image = img.Image(width: 320, height: 240);
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        final value = ((x ~/ 8) + (y ~/ 8)).isEven ? 70 : 210;
        image.setPixelRgb(x, y, value, value, value);
      }
    }
    await file.writeAsBytes(img.encodeJpg(image));
    final result = await const ImageQualityAnalyzer().analyze(file.path);
    expect(result.width, 320);
    expect(result.height, 240);
    expect(result.messages, isNot(contains('Resolution is too low')));
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
