import { ExportFormat } from '@prisma/client';
import {
  generateExport,
  tabularData,
  type ExportRow,
} from './export-formatters';

describe('export formatters', () => {
  const rows: ExportRow[] = [
    {
      university: 'Demo University',
      college: 'Demo College',
      department: 'CSE',
      program: 'B.E. CSE',
      academicYear: '2025-2026',
      studyYear: 'III',
      semester: 'VI',
      class: 'III CSE',
      section: 'A',
      subject: 'Biofuel',
      subjectCode: '023BTV37',
      questionPaperCode: 'Q0013',
      student: 'Student One',
      registerNumber: 'REG001',
      marks: [
        { key: 'Q1', value: '2', maximum: '2' },
        { key: 'Q11(a)', value: '6', maximum: '6' },
      ],
      groupTotals: { PART_A: '20', PART_B_C: '80' },
      grandTotal: '100',
      maximum: '100',
      percentage: '100',
      verificationStatus: 'READY_FOR_EXPORT',
    },
  ];

  it('creates dynamic question and group columns', () => {
    const table = tabularData(rows);
    expect(table.headers).toEqual(
      expect.arrayContaining([
        'Q1 (Max 2)',
        'Q11(a) (Max 6)',
        'PART_A Total',
        'Grand Total',
      ]),
    );
    expect(table.values[0]).toContain('100');
  });

  it.each([
    [ExportFormat.CSV, 'text/csv', Buffer.from('\uFEFF')],
    [ExportFormat.JSON, 'application/json', Buffer.from('{')],
    [
      ExportFormat.XLSX,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.from('PK'),
    ],
    [ExportFormat.PDF, 'application/pdf', Buffer.from('%PDF')],
  ])('generates a valid %s container', (format, mimeType, signature) => {
    const generated = generateExport(format, rows);
    expect(generated.mimeType).toBe(mimeType);
    expect(generated.body.subarray(0, signature.length)).toEqual(signature);
    expect(generated.body.length).toBeGreaterThan(100);
  });
});
