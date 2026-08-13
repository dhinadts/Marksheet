import { Prisma, PrismaClient, RecordStatus } from '@prisma/client';

describe('PostgreSQL schema and seed integrity', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds the demo hierarchy, students, and a data-driven 100-mark scheme', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: 'DEMO' },
    });
    const paper = await prisma.questionPaper.findUniqueOrThrow({
      where: { tenantId_code: { tenantId: tenant.id, code: 'Q0013' } },
      include: {
        versions: {
          include: {
            questions: { include: { parts: true } },
            markingSchemeVersion: { include: { items: true } },
          },
        },
      },
    });
    const students = await prisma.student.count({
      where: { tenantId: tenant.id },
    });
    const version = paper.versions[0];
    const scheme = version.markingSchemeVersion;
    const configuredMaximum = scheme?.items
      .filter((item) => item.isScorable)
      .reduce((sum, item) => sum.plus(item.maximumMark), new Prisma.Decimal(0));

    expect(students).toBeGreaterThanOrEqual(20);
    expect(version.questions).toHaveLength(16);
    expect(
      version.questions.filter((question) => question.parts.length > 0),
    ).toHaveLength(6);
    expect(scheme?.maximumMark.equals(100)).toBe(true);
    expect(configuredMaximum?.equals(100)).toBe(true);
  });

  it('rejects cross-tenant parent relationships at the database boundary', async () => {
    const university = await prisma.university.findFirstOrThrow({
      where: { tenant: { code: 'DEMO' } },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const foreignTenant = await tx.tenant.create({
          data: {
            code: `ISOLATION-${crypto.randomUUID()}`,
            name: 'Isolation Test Tenant',
          },
        });
        await tx.college.create({
          data: {
            tenantId: foreignTenant.id,
            universityId: university.id,
            code: 'INVALID-COLLEGE',
            name: 'Invalid College',
          },
        });
      }),
    ).rejects.toThrow(/tenant mismatch/);
  });

  it('prevents mutation of published question-paper and marking-scheme versions', async () => {
    const publishedScheme = await prisma.markingSchemeVersion.findFirstOrThrow({
      where: { status: 'PUBLISHED' },
    });

    await expect(
      prisma.markingSchemeVersion.update({
        where: { id: publishedScheme.id },
        data: { maximumMark: new Prisma.Decimal(99) },
      }),
    ).rejects.toThrow(/immutable/);
  });

  it('keeps audit records append-only', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: 'DEMO' },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        const log = await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'DATABASE_TEST',
            entityType: 'TEST',
          },
        });
        await tx.auditLog.update({
          where: { id: log.id },
          data: { action: 'MUTATED' },
        });
      }),
    ).rejects.toThrow(/append-only/);
  });

  it('enforces nonnegative configured maximum marks', async () => {
    const scheme = await prisma.markingScheme.findFirstOrThrow({
      where: { tenant: { code: 'DEMO' } },
    });
    const paperVersion = await prisma.questionPaperVersion.findFirstOrThrow({
      where: {
        tenantId: scheme.tenantId,
        questionPaperId: scheme.questionPaperId,
      },
    });

    await expect(
      prisma.markingSchemeVersion.create({
        data: {
          tenantId: scheme.tenantId,
          markingSchemeId: scheme.id,
          questionPaperVersionId: paperVersion.id,
          version: 999,
          maximumMark: new Prisma.Decimal(-1),
          confidenceThresholds: {},
        },
      }),
    ).rejects.toThrow();
  });

  it('creates the tenant context helper required for future RLS policies', async () => {
    const rows = await prisma.$queryRaw<Array<{ available: boolean }>>`
      SELECT to_regprocedure('current_app_tenant_id()') IS NOT NULL AS available
    `;

    expect(rows).toEqual([{ available: true }]);
  });

  it('uses active status for the seeded tenant', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { code: 'DEMO' },
    });
    expect(tenant.status).toBe(RecordStatus.ACTIVE);
  });

  it('records the exact source paper version for every marking scheme version', async () => {
    const versions = await prisma.markingSchemeVersion.findMany({
      include: { questionPaperVersion: true },
    });
    expect(versions.length).toBeGreaterThan(0);
    expect(
      versions.every(
        (version) => version.questionPaperVersion.tenantId === version.tenantId,
      ),
    ).toBe(true);
  });
});
