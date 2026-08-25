import 'package:ai_marks_mobile/models/catalog_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses a student full name as its catalog label', () {
    final item = CatalogItem.fromJson({
      'id': 'student-id',
      'fullName': 'Demo Student',
      'registerNumber': 'REG001',
    });

    expect(item.label, 'Demo Student');
  });

  test('handles a subject offering without a display field', () {
    final item = CatalogItem.fromJson({
      'id': 'offering-id',
      'subjectId': 'subject-id',
    });

    expect(item.label, 'Subject offering');
  });
}
