import 'package:dio/dio.dart';

class DisplayMark {
  const DisplayMark({
    required this.label,
    required this.maximum,
    required this.status,
    required this.displayOrder,
    this.value,
    this.confidence,
  });

  final String label;
  final double? value;
  final double maximum;
  final double? confidence;
  final String status;
  final int displayOrder;

  bool get needsVerification =>
      value == null ||
      !const {'accepted', 'AUTO_ACCEPT', 'VERIFIED'}.contains(status);
}

List<DisplayMark> parseCanonicalQuestionMarks(Map<String, dynamic> json) {
  final result = json['questionWiseResult'];
  if (result is! Map) return const [];
  final canonical = Map<String, dynamic>.from(result);
  final entries = <dynamic>[
    ...(Map<String, dynamic>.from(
              canonical['partA'] as Map? ?? const {},
            )['questions']
            as List? ??
        const []),
    ...(Map<String, dynamic>.from(
              canonical['partBC'] as Map? ?? const {},
            )['questions']
            as List? ??
        const []),
  ];
  return entries.map((entry) {
    final mark = Map<String, dynamic>.from(entry as Map);
    return DisplayMark(
      label: mark['label']?.toString() ?? 'Question ${mark['question'] ?? ''}',
      value: MarkSheetRepository.number(mark['obtained']),
      maximum: MarkSheetRepository.number(mark['maximum']) ?? 0,
      confidence: MarkSheetRepository.number(mark['confidence']),
      status: mark['status']?.toString() ?? 'needs_review',
      displayOrder: (mark['displayOrder'] as num?)?.toInt() ?? 0,
    );
  }).toList()..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
}

class MarkSheetDetail {
  const MarkSheetDetail({
    required this.status,
    required this.student,
    required this.subject,
    required this.hierarchy,
    required this.marks,
    this.imageUrl,
    this.storedTotal,
    this.storedMaximum,
    this.calculationVersion,
  });

  final String status;
  final String student;
  final String subject;
  final String hierarchy;
  final String? imageUrl;
  final List<DisplayMark> marks;
  final double? storedTotal;
  final double? storedMaximum;
  final int? calculationVersion;

  // The captured-sheet screen shows advisory AI values before verification.
  // A persisted calculation can still be 0 at that point because no values
  // have been selected by a reviewer, so derive both totals from the same
  // question-wise marks displayed on screen whenever they are available.
  double get total => marks.isNotEmpty
      ? marks.fold(0, (sum, mark) => sum + (mark.value ?? 0))
      : (storedTotal ?? 0);
  double get maximum => marks.isNotEmpty
      ? marks.fold(0, (sum, mark) => sum + mark.maximum)
      : (storedMaximum ?? 0);
  bool get isComplete =>
      marks.isNotEmpty && marks.every((mark) => mark.value != null);
  bool get partAComplete =>
      _partMarks(partA: true).isNotEmpty &&
      _partMarks(partA: true).every((mark) => mark.value != null);
  bool get partBCComplete =>
      _partMarks(partA: false).isNotEmpty &&
      _partMarks(partA: false).every((mark) => mark.value != null);
  double get partAMaximum =>
      _partMarks(partA: true).fold(0, (sum, mark) => sum + mark.maximum);
  double get partBCMaximum =>
      _partMarks(partA: false).fold(0, (sum, mark) => sum + mark.maximum);

  double get partATotal => marks
      .where((mark) {
        final number = _questionNumber(mark.label);
        return number != null && number <= 10;
      })
      .fold(0, (sum, mark) => sum + (mark.value ?? 0));
  double get partBCTotal => marks
      .where((mark) {
        final number = _questionNumber(mark.label);
        return number != null && number >= 11;
      })
      .fold(0, (sum, mark) => sum + (mark.value ?? 0));

  static int? _questionNumber(String label) {
    final match = RegExp(
      r'^(?:Question\s*|Q)(\d+)',
      caseSensitive: false,
    ).firstMatch(label);
    return match == null ? null : int.tryParse(match.group(1)!);
  }

  Iterable<DisplayMark> _partMarks({required bool partA}) =>
      marks.where((mark) {
        final number = _questionNumber(mark.label);
        return number != null && (partA ? number <= 10 : number >= 11);
      });
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
    final department = Map<String, dynamic>.from(
      student['department'] as Map? ?? const {},
    );
    final college = Map<String, dynamic>.from(
      department['college'] as Map? ?? const {},
    );
    final section = Map<String, dynamic>.from(
      student['section'] as Map? ?? const {},
    );
    final academicClass = Map<String, dynamic>.from(
      section['class'] as Map? ?? const {},
    );
    final academicYear = Map<String, dynamic>.from(
      academicClass['academicYear'] as Map? ?? const {},
    );
    final hierarchy =
        [
              college['name'],
              department['name'],
              academicYear['code'],
              academicClass['name'],
              section['name'],
            ]
            .where((value) => value != null && value.toString().isNotEmpty)
            .join(' • ');
    final sessions = (json['verificationSessions'] as List? ?? const []);
    final items = sessions.isEmpty
        ? const <dynamic>[]
        : (Map<String, dynamic>.from(sessions.first as Map)['items'] as List? ??
              const []);
    final canonicalMarks = parseCanonicalQuestionMarks(json);
    final legacyMarks = items.map((entry) {
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
      final label = [question['label'] ?? question['code'], part['label']]
          .where((value) => value != null && value.toString().isNotEmpty)
          .join(' ');
      return DisplayMark(
        label: label.isEmpty ? 'Mark' : label,
        displayOrder: (scheme['displayOrder'] as num?)?.toInt() ?? 0,
        value: _number(selected?['value'] ?? extracted['extractedValue']),
        maximum: _number(scheme['maximumMark']) ?? 0,
        confidence: _number(extracted['confidence']),
        status:
            extracted['verificationStatus']?.toString() ??
            extracted['extractionStatus']?.toString() ??
            'PENDING',
      );
    }).toList()..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    final marks = canonicalMarks.isNotEmpty ? canonicalMarks : legacyMarks;
    final images = json['images'] as List? ?? const [];
    final calculations = json['calculationResults'] as List? ?? const [];
    final latestCalculation = calculations.isEmpty
        ? const <String, dynamic>{}
        : Map<String, dynamic>.from(calculations.first as Map);
    return MarkSheetDetail(
      status: json['status']?.toString() ?? 'UPLOADED',
      student: '${student['registerNumber'] ?? ''} ${student['fullName'] ?? ''}'
          .trim(),
      subject: '${subject['code'] ?? ''} ${subject['name'] ?? ''}'.trim(),
      hierarchy: hierarchy,
      imageUrl: images.isEmpty
          ? null
          : Map<String, dynamic>.from(images.first as Map)['url']?.toString(),
      marks: marks,
      storedTotal: _number(latestCalculation['grandTotal']),
      storedMaximum: _number(latestCalculation['maximumMark']),
      calculationVersion: (latestCalculation['calculationVersion'] as num?)
          ?.toInt(),
    );
  }

  static double? number(dynamic value) =>
      value == null ? null : double.tryParse(value.toString());

  static double? _number(dynamic value) => number(value);
}
