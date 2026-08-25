interface CapturedMarkSheetKeyInput {
  tenantId: string;
  professorName: string;
  collegeName: string;
  departmentName: string;
  academicYear: string;
  studentName: string;
  studentRegisterNumber: string;
  markSheetId: string;
  pageNumber: number;
  fileId: string;
  mimeType: string;
}

export function capturedMarkSheetKey(input: CapturedMarkSheetKeyInput): string {
  const extension =
    input.mimeType === 'image/png'
      ? 'png'
      : input.mimeType === 'image/heic'
        ? 'heic'
        : 'jpg';
  return [
    input.tenantId,
    'professors',
    segment(input.professorName),
    'colleges',
    segment(input.collegeName),
    'departments',
    segment(input.departmentName),
    'academic-years',
    segment(input.academicYear),
    'students',
    `${segment(input.studentRegisterNumber)}-${segment(input.studentName)}`,
    'mark-sheets',
    input.markSheetId,
    'captured',
    `page-${input.pageNumber}-${input.fileId}.${extension}`,
  ].join('/');
}

function segment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return normalized || 'unknown';
}
