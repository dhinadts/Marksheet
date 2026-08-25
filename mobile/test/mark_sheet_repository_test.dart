import 'package:ai_marks_mobile/repositories/mark_sheet_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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
  });
}
