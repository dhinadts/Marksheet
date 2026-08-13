import 'dart:io';
import 'package:image/image.dart' as img;

class ImageQualityResult {
  const ImageQualityResult({
    required this.acceptable,
    required this.messages,
    required this.width,
    required this.height,
    required this.brightness,
    required this.sharpness,
  });
  final bool acceptable;
  final List<String> messages;
  final int width;
  final int height;
  final double brightness;
  final double sharpness;
}

class ImageQualityAnalyzer {
  const ImageQualityAnalyzer();
  Future<ImageQualityResult> analyze(String path) async {
    final decoded = img.decodeImage(await File(path).readAsBytes());
    if (decoded == null) {
      return const ImageQualityResult(
        acceptable: false,
        messages: ['The image could not be decoded'],
        width: 0,
        height: 0,
        brightness: 0,
        sharpness: 0,
      );
    }
    final sample = img.copyResize(decoded, width: 320);
    var luminance = 0.0;
    var edges = 0.0;
    var count = 0;
    for (var y = 1; y < sample.height; y += 2) {
      for (var x = 1; x < sample.width; x += 2) {
        final current = sample.getPixel(x, y).luminanceNormalized;
        luminance += current;
        edges +=
            (current - sample.getPixel(x - 1, y).luminanceNormalized).abs() +
            (current - sample.getPixel(x, y - 1).luminanceNormalized).abs();
        count++;
      }
    }
    final brightness = luminance / count;
    final sharpness = edges / (count * 2);
    final messages = <String>[];
    if (decoded.width < 1600 || decoded.height < 1200) {
      messages.add('Resolution is too low');
    }
    if (brightness < 0.18) messages.add('Image is too dark');
    if (brightness > 0.92) messages.add('Possible glare or overexposure');
    if (sharpness < 0.025) messages.add('Image may be blurred');
    return ImageQualityResult(
      acceptable: messages.isEmpty,
      messages: messages,
      width: decoded.width,
      height: decoded.height,
      brightness: brightness,
      sharpness: sharpness,
    );
  }
}
