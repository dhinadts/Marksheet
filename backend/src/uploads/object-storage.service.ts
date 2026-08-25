import { createHash, createHmac } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

@Injectable()
export class ObjectStorageService {
  constructor(private readonly config: ConfigService) {}

  get bucketName(): string {
    return this.required('AWS_S3_BUCKET');
  }

  signUpload(
    objectKey: string,
    mimeType: string,
    checksum: string,
  ): SignedRequest {
    return this.sign('PUT', objectKey, {
      'content-type': mimeType,
      'x-amz-meta-sha256': checksum,
    });
  }

  signDownload(objectKey: string): SignedRequest {
    return this.sign('GET', objectKey, {});
  }

  async putGenerated(
    objectKey: string,
    mimeType: string,
    body: Buffer,
  ): Promise<string> {
    const checksum = this.sha256(body);
    const signed = this.signUpload(objectKey, mimeType, checksum);
    const response = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array(body),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Generated file could not be stored',
      );
    return checksum;
  }

  async inspect(
    objectKey: string,
  ): Promise<{ size: number; mimeType: string; checksum?: string }> {
    const signed = this.sign('HEAD', objectKey, {});
    const response = await fetch(signed.url, {
      method: 'HEAD',
      headers: signed.headers,
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Uploaded object is unavailable for verification',
      );
    return {
      size: Number(response.headers.get('content-length') ?? '-1'),
      mimeType:
        response.headers.get('content-type')?.split(';')[0].trim() ?? '',
      checksum: response.headers.get('x-amz-meta-sha256') ?? undefined,
    };
  }

  private sign(
    method: 'PUT' | 'HEAD' | 'GET',
    objectKey: string,
    headers: Record<string, string>,
  ): SignedRequest {
    const region = this.required('AWS_REGION');
    const accessKey = this.required('AWS_ACCESS_KEY_ID');
    const secretKey = this.required('AWS_SECRET_ACCESS_KEY');
    const bucket = this.bucketName;
    const configuredEndpoint = this.config
      .get<string>('AWS_S3_ENDPOINT')
      ?.trim();
    const endpoint = (
      configuredEndpoint || `https://s3.${region}.amazonaws.com`
    ).replace(/\/$/, '');
    const pathStyle =
      this.config.get<string>('AWS_S3_FORCE_PATH_STYLE', 'false') === 'true';
    const base = new URL(endpoint);
    const host = pathStyle ? base.host : `${bucket}.${base.host}`;
    const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
    const path = `${base.pathname.replace(/\/$/, '')}/${pathStyle ? `${bucket}/` : ''}${encodedKey}`;
    const now = new Date();
    const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = stamp.slice(0, 8);
    const expiresSeconds = this.positiveInteger('UPLOAD_URL_TTL_SECONDS', 900);
    const scope = `${date}/${region}/s3/aws4_request`;
    const signedHeaders = [
      'host',
      ...Object.keys(headers).map((key) => key.toLowerCase()),
    ].sort();
    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${scope}`,
      'X-Amz-Date': stamp,
      'X-Amz-Expires': String(expiresSeconds),
      'X-Amz-SignedHeaders': signedHeaders.join(';'),
    });
    query.sort();
    const canonicalHeaders = signedHeaders
      .map((key) => `${key}:${key === 'host' ? host : headers[key].trim()}\n`)
      .join('');
    const canonical = [
      method,
      path,
      query.toString(),
      canonicalHeaders,
      signedHeaders.join(';'),
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      stamp,
      scope,
      this.sha256(canonical),
    ].join('\n');
    const dateKey = this.hmac(`AWS4${secretKey}`, date);
    const regionKey = this.hmac(dateKey, region);
    const serviceKey = this.hmac(regionKey, 's3');
    const signingKey = this.hmac(serviceKey, 'aws4_request');
    query.set(
      'X-Amz-Signature',
      createHmac('sha256', signingKey).update(stringToSign).digest('hex'),
    );
    return {
      url: `${base.protocol}//${host}${path}?${query.toString()}`,
      headers,
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000),
    };
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value)
      throw new ServiceUnavailableException(`${key} is not configured`);
    return value;
  }
  private positiveInteger(key: string, fallback: number): number {
    const value = Number(this.config.get<string | number>(key, fallback));
    if (!Number.isSafeInteger(value) || value < 60 || value > 3600)
      throw new ServiceUnavailableException(
        `${key} must be between 60 and 3600 seconds`,
      );
    return value;
  }
  private sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }
  private hmac(key: string | Buffer, value: string): Buffer {
    return createHmac('sha256', key).update(value).digest();
  }
}
