import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sismos/screens/auth_screen.dart';
import 'package:sismos/theme/app_theme.dart';
import 'package:sismos/widgets/safety_tips_sheet.dart';

void main() {
  testWidgets('login screen switches to register', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: const AuthScreen(),
      ),
    );

    expect(find.text('Entrar'), findsOneWidget);
    expect(find.text('Crear cuenta'), findsNothing);

    await tester.tap(find.text('¿No tienes cuenta? Regístrate'));
    await tester.pump();

    expect(find.text('Crear cuenta'), findsWidgets);
    expect(find.text('¿Ya tienes cuenta? Entra'), findsOneWidget);
  });

  testWidgets('safety tips open in a modal', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: TextButton(
                onPressed: () => showSafetyTips(context),
                child: const Text('Abrir consejos'),
              ),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('Abrir consejos'));
    await tester.pumpAndSettle();

    expect(find.text('Qué hacer en un sismo'), findsOneWidget);
    expect(find.textContaining('Agáchate, cúbrete y sujétate'), findsOneWidget);
    expect(find.text('Durante'), findsOneWidget);
  });

  test('auth errors are translated', () {
    expect(
      messageForAuthError(Exception('offline')),
      'No se pudo completar la solicitud.',
    );
  });
}
