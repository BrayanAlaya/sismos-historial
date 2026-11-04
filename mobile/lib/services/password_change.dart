import 'package:supabase_flutter/supabase_flutter.dart';

import '../screens/auth_screen.dart';

Future<void> replacePasswordByEmail({
  required String email,
  required String password,
}) async {
  try {
    await Supabase.instance.client.functions.invoke(
      'reset-password',
      body: {'email': email, 'password': password},
    );
  } on FunctionException catch (error) {
    throw PasswordChangeException(_resetError(error));
  }
}

String _resetError(FunctionException error) {
  final details = error.details;
  if (details is Map && details['error'] is String) {
    return details['error'] as String;
  }
  if (error.status == 404) return 'No hay una cuenta con ese correo.';
  return 'No se pudo cambiar la contraseña.';
}

class PasswordChangeException implements Exception {
  const PasswordChangeException(this.message);

  final String message;
}

String? currentPasswordIssue(String? value) {
  if ((value ?? '').isEmpty) return 'Escribe tu contraseña actual.';
  return null;
}

String? newPasswordIssue(String value, String current) {
  if (value.length < 6) return 'Usa al menos 6 caracteres.';
  if (value == current) return 'Elige una contraseña distinta a la actual.';
  return null;
}

String? confirmPasswordIssue(String value, String next) {
  if (value != next) return 'La confirmación no coincide.';
  return null;
}

Future<void> updateAccountPassword({
  required String email,
  required String currentPassword,
  required String newPassword,
  SupabaseClient? client,
}) async {
  final auth = (client ?? Supabase.instance.client).auth;
  try {
    await auth.signInWithPassword(email: email, password: currentPassword);
  } on AuthException catch (error) {
    if (error.code == 'invalid_credentials' ||
        error.message.toLowerCase().contains('invalid login')) {
      throw const PasswordChangeException('La contraseña actual no es correcta.');
    }
    throw PasswordChangeException(messageForAuthError(error));
  }

  try {
    await auth.updateUser(UserAttributes(password: newPassword));
  } on AuthException catch (error) {
    if (error.code == 'same_password' ||
        error.message.toLowerCase().contains('different from the old')) {
      throw const PasswordChangeException(
        'Elige una contraseña distinta a la actual.',
      );
    }
    throw PasswordChangeException(messageForAuthError(error));
  }
}
