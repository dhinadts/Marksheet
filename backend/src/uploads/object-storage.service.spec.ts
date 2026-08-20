import { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service';

describe('ObjectStorageService', () => {
  it('creates a short-lived signed tenant object upload with required integrity headers', () => {
    const config = new ConfigService({
      AWS_REGION: 'ap-south-1',
      AWS_ACCESS_KEY_ID: 'test-access',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_S3_BUCKET: 'private-marks',
      UPLOAD_URL_TTL_SECONDS: 600,
    });
    const signed = new ObjectStorageService(config).signUpload(
      'tenant/mark-sheets/id/page-1',
      'image/jpeg',
      'a'.repeat(64),
    );
    expect(signed.url).toContain('X-Amz-Signature=');
    expect(signed.url).toContain('X-Amz-Expires=600');
    expect(signed.headers).toEqual({
      'content-type': 'image/jpeg',
      'x-amz-meta-sha256': 'a'.repeat(64),
    });
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
