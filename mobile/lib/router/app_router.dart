import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/auth/login_screen.dart';
import '../features/capture/capture_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/dashboard/captured_sheets_screen.dart';
import '../features/dashboard/captured_sheet_detail_screen.dart';
import '../features/workflow/selection_screen.dart';
import '../providers/providers.dart';

final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    initialLocation: '/login',
    refreshListenable: _RouterRefresh(ref),
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loggedIn = auth.when(
        data: (value) => value,
        loading: () => false,
        error: (_, _) => false,
      );
      final login = state.matchedLocation == '/login';
      if (!loggedIn && !login) return '/login';
      if (loggedIn && login) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/', builder: (_, _) => const DashboardScreen()),
      GoRoute(
        path: '/captures',
        builder: (_, _) => const CapturedSheetsScreen(),
      ),
      GoRoute(
        path: '/captures/:id',
        builder: (_, state) =>
            CapturedSheetDetailScreen(markSheetId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/select', builder: (_, _) => const SelectionScreen()),
      GoRoute(
        path: '/capture',
        builder: (_, state) =>
            CaptureScreen(selection: state.extra! as Map<String, String>),
      ),
    ],
  ),
);

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}
