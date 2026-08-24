import 'package:ai_marks_mobile/features/auth/login_screen.dart';
import 'package:ai_marks_mobile/auth/auth_controller.dart';
import 'package:ai_marks_mobile/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('login screen exposes username credentials', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('AI-MARKS'), findsOneWidget);
    expect(find.text('Username'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}

class _TestAuthController extends AuthController {
  @override
  Future<bool> build() async => false;
}
