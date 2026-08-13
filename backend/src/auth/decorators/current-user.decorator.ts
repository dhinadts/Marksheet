import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessClaims, AuthenticatedRequest } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessClaims =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
