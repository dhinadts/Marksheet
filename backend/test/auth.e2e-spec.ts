import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication<App>;
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const credentials = {
    username: 'prof01',
    password: 'Qwerty@123',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('rejects invalid credentials without revealing which field failed', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ ...credentials, password: 'incorrect-password' });
    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toContain(credentials.username);
  });

  it('logs in, reads the current user, rotates refresh tokens, and detects reuse', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    const loginTokens = parseTokenResponse(login.text);
    expect(loginTokens.accessToken).toEqual(expect.any(String));
    expect(loginTokens.refreshToken).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginTokens.accessToken}`)
      .expect(200);
    const meBody = JSON.parse(me.text) as Record<string, unknown>;
    expect(meBody).toMatchObject({ tenantId, email: 'prof01@dhinadts.com' });
    expect(meBody.passwordHash).toBeUndefined();

    const rotated = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(200);
    const rotatedTokens = parseTokenResponse(rotated.text);
    expect(rotatedTokens.refreshToken).not.toBe(loginTokens.refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotatedTokens.refreshToken })
      .expect(401);
  });

  it('revokes a refresh-token family on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);
    const loginTokens = parseTokenResponse(login.text);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(401);
  });

  it('validates input and protects authenticated routes', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'x', password: 'short' })
      .expect(400);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});

function parseTokenResponse(text: string): TokenResponse {
  const value = JSON.parse(text) as Partial<TokenResponse>;
  if (
    typeof value.accessToken !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.expiresIn !== 'number'
  ) {
    throw new Error('Invalid token response');
  }
  return value as TokenResponse;
}
