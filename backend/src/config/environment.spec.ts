import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('rejects incomplete production environments', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Missing production configuration',
    );
  });
  it('rejects wildcard production CORS', () => {
    const values = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:secret@db/prod',
      REDIS_URL: 'rediss://cache',
      JWT_SECRET: 'x'.repeat(32),
      AI_INTERNAL_API_KEY: 'internal',
      AWS_REGION: 'ap-south-1',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_S3_BUCKET: 'bucket',
      CORS_ORIGINS: '*',
    };
    expect(() => validateEnvironment(values)).toThrow('Wildcard CORS');
  });
});
