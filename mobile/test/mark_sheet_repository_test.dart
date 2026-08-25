import 'package:ai_marks_mobile/repositories/mark_sheet_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('canonical API mapping preserves zero, strings, and null', () {
    final marks = parseCanonicalQuestionMarks({
      'questionWiseResult': {
        'partA': {
          'questions': [
            {
              'question': 1,
              'label': 'Question 1',
              'obtained': 0,
              'maximum': 2,
              'displayOrder': 1,
            },
            {
              'question': 2,
              'label': 'Question 2',
              'obtained': '2',
              'maximum': '2',
              'displayOrder': 2,
            },
            {
              'question': 3,
              'label': 'Question 3',
              'obtained': null,
              'maximum': 2,
              'displayOrder': 3,
            },
          ],
        },
        'partBC': {'questions': []},
      },
    });

    expect(marks.map((mark) => mark.value).toList(), [0, 2, null]);
    expect(marks.first.value, 0);
    expect(marks.last.needsVerification, isTrue);
  });

  test('captured totals use the extracted marks shown to the reviewer', () {
    const sheet = MarkSheetDetail(
      status: 'REVIEW_REQUIRED',
      student: 'Student',
      subject: 'Subject',
      hierarchy: '',
      storedTotal: 0,
      storedMaximum: 100,
      marks: [
        DisplayMark(
          label: 'Question 1',
          value: 2,
          maximum: 2,
          status: 'AUTO_ACCEPT',
          displayOrder: 1,
        ),
        DisplayMark(
          label: 'Question 2',
          value: 1,
          maximum: 2,
          status: 'REVIEW_REQUIRED',
          displayOrder: 2,
        ),
      ],
    );

    expect(sheet.total, 3);
    expect(sheet.maximum, 4);
    expect(sheet.isComplete, isTrue);
    expect(sheet.partATotal, 3);
    expect(sheet.partBCTotal, 0);
  });

  test(
    'separates Part A and Part B/C totals from configured question labels',
    () {
      const marks = [
        DisplayMark(
          label: 'Q10',
          value: 2,
          maximum: 2,
          status: 'AUTO_ACCEPT',
          displayOrder: 1,
        ),
        DisplayMark(
          label: 'Question 11',
          value: 12,
          maximum: 13,
          status: 'REVIEW_REQUIRED',
          displayOrder: 2,
        ),
      ];
      const sheet = MarkSheetDetail(
        status: 'REVIEW_REQUIRED',
        student: '',
        subject: '',
        hierarchy: '',
        marks: marks,
      );

      expect(sheet.partATotal, 2);
      expect(sheet.partBCTotal, 12);
    },
  );
}
