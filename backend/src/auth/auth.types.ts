export interface AccessClaims {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  tokenVersion: number;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthenticatedRequest {
  user: AccessClaims;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}
