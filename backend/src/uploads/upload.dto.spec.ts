import { validate } from 'class-validator';
import { CreateUploadSessionDto } from './upload.dto';

const validDto = (): CreateUploadSessionDto =>
  Object.assign(new CreateUploadSessionDto(), {
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    studentId: '22222222-2222-4222-8222-222222222222',
    subjectOfferingId: '33333333-3333-4333-8333-333333333333',
    questionPaperVersionId: '44444444-4444-4444-8444-444444444444',
    markingSchemeVersionId: '55555555-5555-4555-8555-555555555555',
    attempt: 1,
    pageNumber: 1,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    checksumSha256: 'a'.repeat(64),
  });

describe('CreateUploadSessionDto', () => {
  it('accepts a bounded image request with a SHA-256 digest', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('rejects non-hex digests and unsupported media types', async () => {
    const dto = validDto();
    dto.checksumSha256 = 'z'.repeat(64);
    dto.mimeType = 'application/pdf';

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['checksumSha256', 'mimeType']),
    );
  });
});
