const productionRequired = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'AI_INTERNAL_API_KEY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'CORS_ORIGINS',
] as const;

export function validateEnvironment(input: Record<string, unknown>) {
  const config = { ...input };
  if (config.NODE_ENV === 'production') {
    const missing = productionRequired.filter(
      (key) => typeof config[key] !== 'string' || !String(config[key]).trim(),
    );
    if (missing.length)
      throw new Error(
        `Missing production configuration: ${missing.join(', ')}`,
      );
    if (String(config.JWT_SECRET).length < 32)
      throw new Error('JWT_SECRET must contain at least 32 characters');
    if (String(config.CORS_ORIGINS).includes('*'))
      throw new Error('Wildcard CORS is forbidden in production');
    if (/change-me|localhost/i.test(String(config.DATABASE_URL)))
      throw new Error(
        'Production DATABASE_URL contains a development placeholder',
      );
  }
  return config;
}
