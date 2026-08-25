import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';
import '../auth/token_store.dart';
import '../network/api_client.dart';
import '../repositories/academic_repository.dart';
import '../repositories/upload_repository.dart';
import '../repositories/mark_sheet_repository.dart';

final tokenStoreProvider = Provider((ref) => TokenStore());
final apiClientProvider = Provider(
  (ref) => ApiClient(
    ref.watch(tokenStoreProvider),
    onSessionExpired: () =>
        ref.read(authControllerProvider.notifier).sessionExpired(),
  ),
);
final academicRepositoryProvider = Provider(
  (ref) => AcademicRepository(ref.watch(apiClientProvider).dio),
);
final uploadRepositoryProvider = Provider(
  (ref) => UploadRepository(ref.watch(apiClientProvider).dio),
);
final markSheetRepositoryProvider = Provider(
  (ref) => MarkSheetRepository(ref.watch(apiClientProvider).dio),
);
final authControllerProvider = AsyncNotifierProvider<AuthController, bool>(
  AuthController.new,
);
