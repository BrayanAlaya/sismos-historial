import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sismos/screens/auth_screen.dart';
import 'package:sismos/services/password_change.dart';
import 'package:sismos/theme/app_theme.dart';
import 'package:sismos/widgets/change_password_form.dart';
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
    expect(find.text('Olvidé mi contraseña'), findsNothing);
  });

  testWidgets('forgot password asks for the email and a new password', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: const AuthScreen(),
      ),
    );

    await tester.tap(find.text('Olvidé mi contraseña'));
    await tester.pump();

    expect(find.text('Recuperar contraseña'), findsOneWidget);
    expect(find.text('Cambiar contraseña'), findsOneWidget);
    expect(find.text('Nueva contraseña'), findsOneWidget);
    expect(find.text('Confirmar nueva contraseña'), findsOneWidget);
    expect(find.text('Volver a entrar'), findsOneWidget);
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

  test('password change rejects a short, repeated or mismatched password', () {
    expect(currentPasswordIssue(''), 'Escribe tu contraseña actual.');
    expect(newPasswordIssue('123', '123'), 'Usa al menos 6 caracteres.');
    expect(
      newPasswordIssue('secreto', 'secreto'),
      'Elige una contraseña distinta a la actual.',
    );
    expect(confirmPasswordIssue('otra', 'secreto2'), 'La confirmación no coincide.');
    expect(newPasswordIssue('secreto2', 'secreto'), isNull);
    expect(confirmPasswordIssue('secreto2', 'secreto2'), isNull);
  });

  testWidgets('change password form asks for the current and new password', (tester) async {
    String? savedCurrent;
    String? savedNext;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: Scaffold(
          body: ChangePasswordForm(
            onSubmit: (currentPassword, newPassword) async {
              savedCurrent = currentPassword;
              savedNext = newPassword;
            },
          ),
        ),
      ),
    );

    expect(find.text('Guardar contraseña'), findsOneWidget);

    await tester.tap(find.text('Guardar contraseña'));
    await tester.pump();

    expect(find.text('Escribe tu contraseña actual.'), findsOneWidget);
    expect(savedNext, isNull);

    await tester.enterText(find.byKey(const Key('current-password')), 'actual1');
    await tester.enterText(find.byKey(const Key('new-password')), 'nueva123');
    await tester.enterText(find.byKey(const Key('confirm-password')), 'nueva123');
    await tester.tap(find.text('Guardar contraseña'));
    await tester.pumpAndSettle();

    expect(savedCurrent, 'actual1');
    expect(savedNext, 'nueva123');
    expect(find.text('Contraseña actualizada.'), findsOneWidget);
  });

  test('auth errors are translated', () {
    expect(
      messageForAuthError(Exception('offline')),
      'No se pudo completar la solicitud.',
    );
  });
}
