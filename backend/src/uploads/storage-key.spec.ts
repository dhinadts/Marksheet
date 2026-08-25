import { capturedMarkSheetKey } from './storage-key';

describe('capturedMarkSheetKey', () => {
  it('builds a tenant-safe professor and academic hierarchy', () => {
    expect(
      capturedMarkSheetKey({
        tenantId: 'tenant-id',
        professorName: 'Prof. Nagarajan',
        collegeName: 'Vivekanandha College',
        departmentName: 'Computer Science & Engineering',
        academicYear: '2026-27',
        studentName: 'Demo Student 20',
        studentRegisterNumber: 'DEMO25CSE020',
        markSheetId: 'sheet-id',
        pageNumber: 1,
        fileId: 'file-id',
        mimeType: 'image/jpeg',
      }),
    ).toBe(
      'tenant-id/professors/prof-nagarajan/colleges/vivekanandha-college/departments/computer-science-engineering/academic-years/2026-27/students/demo25cse020-demo-student-20/mark-sheets/sheet-id/captured/page-1-file-id.jpg',
    );
  });
});
