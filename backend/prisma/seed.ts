import {
  Prisma,
  PrismaClient,
  RecordStatus,
  VersionStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ids = {
  tenant: '00000000-0000-4000-8000-000000000001',
  university: '00000000-0000-4000-8000-000000000002',
  college: '00000000-0000-4000-8000-000000000003',
  department: '00000000-0000-4000-8000-000000000004',
  program: '00000000-0000-4000-8000-000000000005',
  academicYear: '00000000-0000-4000-8000-000000000006',
  studyYear: '00000000-0000-4000-8000-000000000007',
  semester: '00000000-0000-4000-8000-000000000008',
  academicClass: '00000000-0000-4000-8000-000000000009',
  section: '00000000-0000-4000-8000-00000000000a',
  subject: '00000000-0000-4000-8000-00000000000b',
  subjectOffering: '00000000-0000-4000-8000-00000000000c',
  questionPaper: '00000000-0000-4000-8000-00000000000d',
  questionPaperVersion: '00000000-0000-4000-8000-00000000000e',
  markingScheme: '00000000-0000-4000-8000-00000000000f',
  markingSchemeVersion: '00000000-0000-4000-8000-000000000010',
} as const;

const uuid = (namespace: number, ordinal: number): string =>
  `00000000-0000-4${namespace.toString(16).padStart(3, '0')}-8000-${ordinal
    .toString(16)
    .padStart(12, '0')}`;

const roles = [
  'SUPER_ADMIN',
  'UNIVERSITY_ADMIN',
  'COLLEGE_ADMIN',
  'EXAM_CONTROLLER',
  'DEPARTMENT_ADMIN',
  'VALUATOR',
  'REVIEWER',
  'DATA_ENTRY_OPERATOR',
  'VIEWER',
] as const;

const permissions = [
  'master_data.read',
  'master_data.manage',
  'question_paper.read',
  'question_paper.manage',
  'marking_scheme.read',
  'marking_scheme.manage',
  'mark_sheet.read',
  'mark_sheet.upload',
  'mark.review',
  'mark.verify',
  'report.read',
  'export.create',
  'audit.read',
  'user.manage',
] as const;

async function seedAuthorization(tx: Prisma.TransactionClient): Promise<void> {
  for (const [index, code] of permissions.entries()) {
    await tx.permission.upsert({
      where: { code },
      update: { description: `Allows ${code.replace('.', ' ')}` },
      create: {
        id: uuid(0x100, index + 1),
        code,
        description: `Allows ${code.replace('.', ' ')}`,
      },
    });
  }

  for (const [index, code] of roles.entries()) {
    await tx.role.upsert({
      where: { tenantId_code: { tenantId: ids.tenant, code } },
      update: { name: code.replaceAll('_', ' '), isSystem: true },
      create: {
        id: uuid(0x101, index + 1),
        tenantId: ids.tenant,
        code,
        name: code.replaceAll('_', ' '),
        isSystem: true,
      },
    });
  }

  const seededRoles = await tx.role.findMany({
    where: { tenantId: ids.tenant },
  });
  const seededPermissions = await tx.permission.findMany();
  const permissionSets: Record<string, string[]> = {
    SUPER_ADMIN: seededPermissions.map(({ code }) => code),
    UNIVERSITY_ADMIN: seededPermissions
      .map(({ code }) => code)
      .filter((code) => code !== 'user.manage'),
    COLLEGE_ADMIN: [
      'master_data.read',
      'master_data.manage',
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'report.read',
    ],
    EXAM_CONTROLLER: [
      'question_paper.read',
      'question_paper.manage',
      'marking_scheme.read',
      'marking_scheme.manage',
      'mark_sheet.read',
      'mark.verify',
      'report.read',
      'export.create',
      'audit.read',
    ],
    DEPARTMENT_ADMIN: [
      'master_data.read',
      'master_data.manage',
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'report.read',
    ],
    VALUATOR: [
      'master_data.read',
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'mark_sheet.upload',
      'mark.review',
    ],
    REVIEWER: [
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'mark.review',
      'mark.verify',
    ],
    DATA_ENTRY_OPERATOR: [
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'mark_sheet.upload',
      'mark.review',
    ],
    VIEWER: [
      'master_data.read',
      'question_paper.read',
      'marking_scheme.read',
      'mark_sheet.read',
      'report.read',
    ],
  };
  for (const role of seededRoles) {
    for (const permissionCode of permissionSets[role.code] ?? []) {
      const permission = seededPermissions.find(
        ({ code }) => code === permissionCode,
      );
      if (!permission) continue;
      await tx.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId: ids.tenant,
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          tenantId: ids.tenant,
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedDevelopmentUser(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const role = await tx.role.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'VALUATOR' } },
  });
  const passwordHash = await argon2.hash('Qwerty@123', { type: argon2.argon2id });
  for (let index = 1; index <= 5; index += 1) {
    const username = `prof${index.toString().padStart(2, '0')}`;
    const user = await tx.user.upsert({
      where: { username },
      update: {
        email: `${username}@dhinadts.com`,
        displayName: `Professor ${index.toString().padStart(2, '0')}`,
        passwordHash,
        status: RecordStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        tenantId: ids.tenant,
        username,
        email: `${username}@dhinadts.com`,
        displayName: `Professor ${index.toString().padStart(2, '0')}`,
        passwordHash,
      },
    });
    await tx.userRole.upsert({
      where: { tenantId_userId_roleId: { tenantId: ids.tenant, userId: user.id, roleId: role.id } },
      update: {},
      create: { tenantId: ids.tenant, userId: user.id, roleId: role.id },
    });
    await tx.professorProfile.upsert({
      where: { userId: user.id },
      update: {
        departmentId: ids.department,
        firstName: 'Professor',
        lastName: index.toString().padStart(2, '0'),
      },
      create: {
        tenantId: ids.tenant,
        userId: user.id,
        departmentId: ids.department,
        employeeNumber: `DEMO-PROF-${index.toString().padStart(3, '0')}`,
        firstName: 'Professor',
        lastName: index.toString().padStart(2, '0'),
      },
    });
  }
}

async function seedAcademicStructure(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.tenant.upsert({
    where: { code: 'DEMO' },
    update: { name: 'Demo Education Tenant', status: RecordStatus.ACTIVE },
    create: { id: ids.tenant, code: 'DEMO', name: 'Demo Education Tenant' },
  });
  await tx.university.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'DEMO-UNI' } },
    update: { name: 'Demo University' },
    create: {
      id: ids.university,
      tenantId: ids.tenant,
      code: 'DEMO-UNI',
      name: 'Demo University',
    },
  });
  await tx.college.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'DEMO-ENG' } },
    update: { name: 'Demo Engineering College', universityId: ids.university },
    create: {
      id: ids.college,
      tenantId: ids.tenant,
      universityId: ids.university,
      code: 'DEMO-ENG',
      name: 'Demo Engineering College',
    },
  });
  await tx.department.upsert({
    where: {
      tenantId_collegeId_code: {
        tenantId: ids.tenant,
        collegeId: ids.college,
        code: 'CSE',
      },
    },
    update: { name: 'Computer Science and Engineering' },
    create: {
      id: ids.department,
      tenantId: ids.tenant,
      collegeId: ids.college,
      code: 'CSE',
      name: 'Computer Science and Engineering',
    },
  });
  await tx.program.upsert({
    where: {
      tenantId_departmentId_code: {
        tenantId: ids.tenant,
        departmentId: ids.department,
        code: 'BE-CSE',
      },
    },
    update: { name: 'B.E. Computer Science and Engineering' },
    create: {
      id: ids.program,
      tenantId: ids.tenant,
      departmentId: ids.department,
      code: 'BE-CSE',
      name: 'B.E. Computer Science and Engineering',
    },
  });
  await tx.academicYear.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: '2025-2026' } },
    update: {},
    create: {
      id: ids.academicYear,
      tenantId: ids.tenant,
      code: '2025-2026',
      startsOn: new Date('2025-07-01T00:00:00.000Z'),
      endsOn: new Date('2026-06-30T00:00:00.000Z'),
    },
  });
  await tx.studyYear.upsert({
    where: { tenantId_ordinal: { tenantId: ids.tenant, ordinal: 3 } },
    update: { displayName: 'III Year' },
    create: {
      id: ids.studyYear,
      tenantId: ids.tenant,
      ordinal: 3,
      displayName: 'III Year',
    },
  });
  await tx.semester.upsert({
    where: {
      tenantId_academicYearId_ordinal: {
        tenantId: ids.tenant,
        academicYearId: ids.academicYear,
        ordinal: 6,
      },
    },
    update: { displayName: 'VI Semester' },
    create: {
      id: ids.semester,
      tenantId: ids.tenant,
      academicYearId: ids.academicYear,
      ordinal: 6,
      displayName: 'VI Semester',
    },
  });
  await tx.academicClass.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'III-CSE' } },
    update: { name: 'III CSE' },
    create: {
      id: ids.academicClass,
      tenantId: ids.tenant,
      programId: ids.program,
      academicYearId: ids.academicYear,
      studyYearId: ids.studyYear,
      semesterId: ids.semester,
      code: 'III-CSE',
      name: 'III CSE',
    },
  });
  await tx.section.upsert({
    where: {
      tenantId_classId_code: {
        tenantId: ids.tenant,
        classId: ids.academicClass,
        code: 'A',
      },
    },
    update: { name: 'III CSE A' },
    create: {
      id: ids.section,
      tenantId: ids.tenant,
      classId: ids.academicClass,
      code: 'A',
      name: 'III CSE A',
    },
  });
  await tx.subject.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: '023BTV37' } },
    update: { name: 'Biofuel and Bioenergy' },
    create: {
      id: ids.subject,
      tenantId: ids.tenant,
      departmentId: ids.department,
      code: '023BTV37',
      name: 'Biofuel and Bioenergy',
    },
  });
  await tx.subjectOffering.upsert({
    where: {
      tenantId_subjectId_academicYearId_sectionId: {
        tenantId: ids.tenant,
        subjectId: ids.subject,
        academicYearId: ids.academicYear,
        sectionId: ids.section,
      },
    },
    update: {},
    create: {
      id: ids.subjectOffering,
      tenantId: ids.tenant,
      subjectId: ids.subject,
      programId: ids.program,
      academicYearId: ids.academicYear,
      semesterId: ids.semester,
      sectionId: ids.section,
    },
  });

  for (let index = 1; index <= 120; index += 1) {
    const registerNumber = `DEMO25CSE${index.toString().padStart(3, '0')}`;
    await tx.student.upsert({
      where: {
        tenantId_registerNumber: { tenantId: ids.tenant, registerNumber },
      },
      update: {
        fullName: `Demo Student ${index.toString().padStart(3, '0')}`,
        firstName: 'Demo',
        lastName: `Student ${index.toString().padStart(3, '0')}`,
        dateOfBirth: new Date(
          `${2004 + (index % 3)}-${((index % 12) + 1).toString().padStart(2, '0')}-${((index % 27) + 1).toString().padStart(2, '0')}T00:00:00.000Z`,
        ),
      },
      create: {
        id: uuid(0x200, index),
        tenantId: ids.tenant,
        departmentId: ids.department,
        programId: ids.program,
        sectionId: ids.section,
        registerNumber,
        fullName: `Demo Student ${index.toString().padStart(3, '0')}`,
        firstName: 'Demo',
        lastName: `Student ${index.toString().padStart(3, '0')}`,
        dateOfBirth: new Date(
          `${2004 + (index % 3)}-${((index % 12) + 1).toString().padStart(2, '0')}-${((index % 27) + 1).toString().padStart(2, '0')}T00:00:00.000Z`,
        ),
      },
    });
  }
}

async function seedRollStudents(tx: Prisma.TransactionClient): Promise<void> {
  for (let index = 1; index <= 20; index += 1) {
    const registerNumber = `ROLL${index.toString().padStart(2, '0')}`;
    await tx.student.upsert({
      where: {
        tenantId_registerNumber: { tenantId: ids.tenant, registerNumber },
      },
      update: {
        fullName: `Student ${index.toString().padStart(2, '0')}`,
        firstName: 'Student',
        lastName: index.toString().padStart(2, '0'),
      },
      create: {
        id: uuid(0x700, index),
        tenantId: ids.tenant,
        departmentId: ids.department,
        programId: ids.program,
        sectionId: ids.section,
        registerNumber,
        fullName: `Student ${index.toString().padStart(2, '0')}`,
        firstName: 'Student',
        lastName: index.toString().padStart(2, '0'),
      },
    });
  }
}

async function seedQuestionPaper(tx: Prisma.TransactionClient): Promise<void> {
  const imageTemplate = {
    expectedAspectRatio: 0.751,
    aspectRatioTolerance: 0.25,
    cells: [
      ...Array.from({ length: 10 }, (_, index) => ({
        questionCode: `Q${index + 1}`,
        box: {
          x: 0.205,
          y: 0.575 + index * 0.0235,
          width: 0.075,
          height: 0.027,
        },
      })),
      ...Array.from({ length: 6 }, (_, index) =>
        ['a', 'b'].map((questionPartCode, partIndex) => ({
          questionCode: `Q${index + 11}`,
          questionPartCode,
          box: {
            x: 0.415,
            y: 0.575 + (index * 2 + partIndex) * 0.0235,
            width: 0.16,
            height: 0.027,
          },
        })),
      ).flat(),
    ],
  } satisfies Prisma.InputJsonObject;
  const existingPublishedVersion = await tx.questionPaperVersion.findUnique({
    where: { id: ids.questionPaperVersion },
    select: { status: true },
  });
  if (existingPublishedVersion?.status === VersionStatus.PUBLISHED) {
    await tx.questionPaperVersion.update({
      where: { id: ids.questionPaperVersion },
      data: { imageTemplate },
    });
    return;
  }

  await tx.questionPaper.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'Q0013' } },
    update: { title: 'Biofuel and Bioenergy Sample Examination' },
    create: {
      id: ids.questionPaper,
      tenantId: ids.tenant,
      subjectId: ids.subject,
      code: 'Q0013',
      title: 'Biofuel and Bioenergy Sample Examination',
    },
  });
  await tx.markingScheme.upsert({
    where: { tenantId_code: { tenantId: ids.tenant, code: 'Q0013-SCHEME' } },
    update: { name: 'Q0013 Sample Marking Scheme' },
    create: {
      id: ids.markingScheme,
      tenantId: ids.tenant,
      questionPaperId: ids.questionPaper,
      code: 'Q0013-SCHEME',
      name: 'Q0013 Sample Marking Scheme',
    },
  });
  await tx.questionPaperVersion.upsert({
    where: {
      tenantId_questionPaperId_version: {
        tenantId: ids.tenant,
        questionPaperId: ids.questionPaper,
        version: 1,
      },
    },
    update: { imageTemplate },
    create: {
      id: ids.questionPaperVersion,
      tenantId: ids.tenant,
      questionPaperId: ids.questionPaper,
      version: 1,
      status: VersionStatus.DRAFT,
      imageTemplate,
    },
  });
  await tx.markingSchemeVersion.upsert({
    where: {
      tenantId_markingSchemeId_version: {
        tenantId: ids.tenant,
        markingSchemeId: ids.markingScheme,
        version: 1,
      },
    },
    update: {},
    create: {
      id: ids.markingSchemeVersion,
      tenantId: ids.tenant,
      markingSchemeId: ids.markingScheme,
      questionPaperVersionId: ids.questionPaperVersion,
      version: 1,
      status: VersionStatus.DRAFT,
      maximumMark: new Prisma.Decimal(100),
      confidenceThresholds: {
        autoAccept: 0.95,
        reviewRecommended: 0.8,
        reviewRequired: 0.6,
      },
    },
  });
  await tx.questionPaperVersion.upsert({
    where: {
      tenantId_questionPaperId_version: {
        tenantId: ids.tenant,
        questionPaperId: ids.questionPaper,
        version: 1,
      },
    },
    update: {
      markingSchemeVersionId: ids.markingSchemeVersion,
      imageTemplate,
    },
    create: {
      id: ids.questionPaperVersion,
      tenantId: ids.tenant,
      questionPaperId: ids.questionPaper,
      version: 1,
      status: VersionStatus.DRAFT,
      markingSchemeVersionId: ids.markingSchemeVersion,
      imageTemplate,
    },
  });

  for (let number = 1; number <= 16; number += 1) {
    const questionId = uuid(0x300, number);
    const groupCode = number <= 10 ? 'PART_A' : 'PART_B_C';
    await tx.question.upsert({
      where: {
        tenantId_questionPaperVersionId_code: {
          tenantId: ids.tenant,
          questionPaperVersionId: ids.questionPaperVersion,
          code: `Q${number}`,
        },
      },
      update: { label: `Question ${number}`, groupCode, displayOrder: number },
      create: {
        id: questionId,
        tenantId: ids.tenant,
        questionPaperVersionId: ids.questionPaperVersion,
        code: `Q${number}`,
        label: `Question ${number}`,
        groupCode,
        displayOrder: number,
      },
    });

    const maximum = number <= 10 ? 2 : number <= 15 ? 13 : 15;
    if (number <= 10) {
      await upsertSchemeItem(tx, {
        id: uuid(0x400, number),
        questionId,
        questionPartId: null,
        parentItemId: null,
        displayOrder: number * 10,
        maximumMark: maximum,
        groupCode,
        isScorable: true,
      });
      continue;
    }

    const parentItemId = uuid(0x400, number);
    await upsertSchemeItem(tx, {
      id: parentItemId,
      questionId,
      questionPartId: null,
      parentItemId: null,
      displayOrder: number * 10,
      maximumMark: maximum,
      groupCode,
      isScorable: false,
    });

    const partMaximums = number === 16 ? [7, 8] : [6, 7];
    for (const [partIndex, partMaximum] of partMaximums.entries()) {
      const partCode = String.fromCharCode(97 + partIndex);
      const questionPartId = uuid(0x500 + number, partIndex + 1);
      await tx.questionPart.upsert({
        where: {
          tenantId_questionId_code: {
            tenantId: ids.tenant,
            questionId,
            code: partCode,
          },
        },
        update: { label: `Part ${partCode}`, displayOrder: partIndex + 1 },
        create: {
          id: questionPartId,
          tenantId: ids.tenant,
          questionId,
          code: partCode,
          label: `Part ${partCode}`,
          displayOrder: partIndex + 1,
        },
      });
      await upsertSchemeItem(tx, {
        id: uuid(0x600 + number, partIndex + 1),
        questionId,
        questionPartId,
        parentItemId,
        displayOrder: number * 10 + partIndex + 1,
        maximumMark: partMaximum,
        groupCode,
        isScorable: true,
      });
    }
  }

  const publishedAt = new Date('2025-07-01T00:00:00.000Z');
  await tx.markingSchemeVersion.update({
    where: { id: ids.markingSchemeVersion },
    data: { status: VersionStatus.PUBLISHED, publishedAt },
  });
  await tx.questionPaperVersion.update({
    where: { id: ids.questionPaperVersion },
    data: { status: VersionStatus.PUBLISHED, publishedAt, imageTemplate },
  });
}

async function upsertSchemeItem(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    questionId: string;
    questionPartId: string | null;
    parentItemId: string | null;
    displayOrder: number;
    maximumMark: number;
    groupCode: string;
    isScorable: boolean;
  },
): Promise<void> {
  await tx.markingSchemeItem.upsert({
    where: { id: item.id },
    update: {
      maximumMark: new Prisma.Decimal(item.maximumMark),
      groupCode: item.groupCode,
      displayOrder: item.displayOrder,
      isScorable: item.isScorable,
    },
    create: {
      ...item,
      tenantId: ids.tenant,
      markingSchemeVersionId: ids.markingSchemeVersion,
      maximumMark: new Prisma.Decimal(item.maximumMark),
    },
  });
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await seedAcademicStructure(tx);
    await seedAuthorization(tx);
    await seedDevelopmentUser(tx);
    await seedRollStudents(tx);
    await seedQuestionPaper(tx);
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
