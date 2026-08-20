import { deflateRawSync } from 'node:zlib';
import { ExportFormat } from '@prisma/client';

export interface ExportRow {
  university: string;
  college: string;
  department: string;
  program: string;
  academicYear: string;
  studyYear: string;
  semester: string;
  class: string;
  section: string;
  subject: string;
  subjectCode: string;
  questionPaperCode: string;
  student: string;
  registerNumber: string;
  marks: { key: string; value: string | null; maximum: string }[];
  groupTotals: Record<string, string>;
  grandTotal: string;
  maximum: string;
  percentage: string;
  verificationStatus: string;
}

export interface GeneratedExport {
  body: Buffer;
  mimeType: string;
  extension: string;
}

const fixedHeaders = [
  'University',
  'College',
  'Department',
  'Program',
  'Academic Year',
  'Study Year',
  'Semester',
  'Class',
  'Section',
  'Subject',
  'Subject Code',
  'Question Paper Code',
  'Student',
  'Register Number',
];

export function tabularData(rows: ExportRow[]): {
  headers: string[];
  values: string[][];
} {
  const markHeaders = [
    ...new Set(
      rows.flatMap((row) =>
        row.marks.map((mark) => `${mark.key} (Max ${mark.maximum})`),
      ),
    ),
  ];
  const groupHeaders = [
    ...new Set(rows.flatMap((row) => Object.keys(row.groupTotals))),
  ]
    .sort()
    .map((group) => `${group} Total`);
  const headers = [
    ...fixedHeaders,
    ...markHeaders,
    ...groupHeaders,
    'Grand Total',
    'Maximum',
    'Percentage',
    'Verification Status',
  ];
  const values = rows.map((row) => {
    const marks = new Map(
      row.marks.map((mark) => [
        `${mark.key} (Max ${mark.maximum})`,
        mark.value ?? '',
      ]),
    );
    return [
      row.university,
      row.college,
      row.department,
      row.program,
      row.academicYear,
      row.studyYear,
      row.semester,
      row.class,
      row.section,
      row.subject,
      row.subjectCode,
      row.questionPaperCode,
      row.student,
      row.registerNumber,
      ...markHeaders.map((header) => marks.get(header) ?? ''),
      ...groupHeaders.map(
        (header) => row.groupTotals[header.slice(0, -6)] ?? '',
      ),
      row.grandTotal,
      row.maximum,
      row.percentage,
      row.verificationStatus,
    ];
  });
  return { headers, values };
}

export function generateExport(
  format: ExportFormat,
  rows: ExportRow[],
): GeneratedExport {
  const table = tabularData(rows);
  switch (format) {
    case ExportFormat.JSON:
      return {
        body: Buffer.from(
          JSON.stringify(
            { generatedAt: new Date().toISOString(), rows },
            null,
            2,
          ),
        ),
        mimeType: 'application/json',
        extension: 'json',
      };
    case ExportFormat.CSV:
      return {
        body: Buffer.from(
          `\uFEFF${[table.headers, ...table.values].map((row) => row.map(csvCell).join(',')).join('\r\n')}`,
        ),
        mimeType: 'text/csv',
        extension: 'csv',
      };
    case ExportFormat.XLSX:
      return {
        body: makeXlsx(table.headers, table.values),
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    case ExportFormat.PDF:
      return {
        body: makePdf(table.headers, table.values),
        mimeType: 'application/pdf',
        extension: 'pdf',
      };
  }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeXlsx(headers: string[], rows: string[][]): Buffer {
  const sheetRows = [headers, ...rows]
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((value, column) => `<c r="${columnName(column)}${index + 1}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`).join('')}</row>`,
    )
    .join('');
  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Marks" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ],
    [
      'xl/worksheets/sheet1.xml',
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ],
  ]);
}

function columnName(index: number): string {
  let value = '';
  for (
    let current = index + 1;
    current > 0;
    current = Math.floor((current - 1) / 26)
  )
    value = String.fromCharCode(65 + ((current - 1) % 26)) + value;
  return value;
}

function zip(files: [string, string][]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const filename = Buffer.from(name);
    const data = Buffer.from(text);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePdf(headers: string[], rows: string[][]): Buffer {
  const lines = [
    'AI-MARKS VERIFIED RESULTS',
    '',
    headers.join(' | '),
    ...rows.map((row) => row.join(' | ')),
  ];
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42)
    pages.push(lines.slice(index, index + 42));
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const content = `BT /F1 7 Tf 25 570 Td ${pageLines.map((line, index) => `${index ? '0 -13 Td ' : ''}(${pdfText(line.slice(0, 150))}) Tj`).join(' ')} ET`;
    const contentId = objects.length + 1;
    objects.push(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
    const pageId = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join(
      '\n',
    )}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document, 'binary');
}
function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1');
}
