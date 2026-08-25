import 'package:dio/dio.dart';

class DisplayMark {
  const DisplayMark({
    required this.label,
    required this.maximum,
    required this.status,
    this.value,
    this.confidence,
  });

  final String label;
  final double? value;
  final double maximum;
  final double? confidence;
  final String status;
}

class MarkSheetDetail {
  const MarkSheetDetail({
    required this.status,
    required this.student,
    required this.subject,
    required this.marks,
    this.imageUrl,
  });

  final String status;
  final String student;
  final String subject;
  final String? imageUrl;
  final List<DisplayMark> marks;

  double get total => marks.fold(0, (sum, mark) => sum + (mark.value ?? 0));
  double get maximum => marks.fold(0, (sum, mark) => sum + mark.maximum);
  bool get isComplete =>
      marks.isNotEmpty && marks.every((mark) => mark.value != null);
}

class MarkSheetRepository {
  const MarkSheetRepository(this._dio);
  final Dio _dio;

  Future<MarkSheetDetail> detail(String id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/mark-sheets/$id/review',
    );
    final json = response.data!;
    final student = Map<String, dynamic>.from(
      json['student'] as Map? ?? const {},
    );
    final offering = Map<String, dynamic>.from(
      json['subjectOffering'] as Map? ?? const {},
    );
    final subject = Map<String, dynamic>.from(
      offering['subject'] as Map? ?? const {},
    );
    final sessions = (json['verificationSessions'] as List? ?? const []);
    final items = sessions.isEmpty
        ? const <dynamic>[]
        : (Map<String, dynamic>.from(sessions.first as Map)['items'] as List? ??
              const []);
    final marks = items.map((entry) {
      final item = Map<String, dynamic>.from(entry as Map);
      final extracted = Map<String, dynamic>.from(item['extractedMark'] as Map);
      final scheme = Map<String, dynamic>.from(
        extracted['markingSchemeItem'] as Map? ?? const {},
      );
      final question = Map<String, dynamic>.from(
        scheme['question'] as Map? ?? const {},
      );
      final part = Map<String, dynamic>.from(
        scheme['questionPart'] as Map? ?? const {},
      );
      final selected = item['selectedMarkValue'] == null
          ? null
          : Map<String, dynamic>.from(item['selectedMarkValue'] as Map);
      final label = [question['number'], part['label']]
          .where((value) => value != null && value.toString().isNotEmpty)
          .join(' ');
      return DisplayMark(
        label: label.isEmpty ? 'Mark' : label,
        value: _number(selected?['value'] ?? extracted['extractedValue']),
        maximum: _number(scheme['maximumMark']) ?? 0,
        confidence: _number(extracted['confidence']),
        status:
            extracted['verificationStatus']?.toString() ??
            extracted['extractionStatus']?.toString() ??
            'PENDING',
      );
    }).toList();
    final images = json['images'] as List? ?? const [];
    return MarkSheetDetail(
      status: json['status']?.toString() ?? 'UPLOADED',
      student: '${student['registerNumber'] ?? ''} ${student['fullName'] ?? ''}'
          .trim(),
      subject: '${subject['code'] ?? ''} ${subject['name'] ?? ''}'.trim(),
      imageUrl: images.isEmpty
          ? null
          : Map<String, dynamic>.from(images.first as Map)['url']?.toString(),
      marks: marks,
    );
  }

  static double? _number(dynamic value) =>
      value == null ? null : double.tryParse(value.toString());
}
