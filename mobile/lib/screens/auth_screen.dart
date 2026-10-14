import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/supabase_settings.dart';
import '../theme/app_theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.onChangeProject});

  final Future<void> Function()? onChangeProject;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  var _registering = false;
  var _submitting = false;
  var _obscurePassword = true;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
      _info = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    try {
      final auth = Supabase.instance.client.auth;
      if (_registering) {
        final response = await auth.signUp(email: email, password: password);
        if (!mounted) return;
        if (response.session == null) {
          setState(() {
            _registering = false;
            _info = 'Cuenta creada. Revisa tu correo para confirmarla y luego entra.';
          });
        }
      } else {
        await auth.signInWithPassword(email: email, password: password);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = messageForAuthError(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _changeProject() async {
    final change = widget.onChangeProject;
    if (change == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Cambiar proyecto'),
          content: const Text(
            'Se borrarán la URL y la clave guardadas en este teléfono.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Cambiar'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) return;
    await SupabaseSettings.clearSaved();
    if (!mounted) return;
    await change();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'USGS · TIEMPO REAL',
                      style: TextStyle(
                        color: kKicker,
                        fontSize: 12,
                        letterSpacing: 1.4,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _registering ? 'Crear cuenta' : 'Entra a Sismos',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'El mapa en vivo queda detrás de tu cuenta.',
                      style: TextStyle(color: kMuted),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      enabled: !_submitting,
                      decoration: const InputDecoration(labelText: 'Correo'),
                      validator: (value) {
                        final email = value?.trim() ?? '';
                        if (!email.contains('@') || !email.contains('.')) {
                          return 'Escribe un correo válido.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      autofillHints: [
                        _registering
                            ? AutofillHints.newPassword
                            : AutofillHints.password,
                      ],
                      textInputAction: TextInputAction.done,
                      enabled: !_submitting,
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        suffixIcon: IconButton(
                          onPressed: () {
                            setState(
                              () => _obscurePassword = !_obscurePassword,
                            );
                          },
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        if ((value ?? '').length < 6) {
                          return 'Usa al menos 6 caracteres.';
                        }
                        return null;
                      },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Text(
                        _error!,
                        style: const TextStyle(color: Color(0xFFF87171)),
                      ),
                    ],
                    if (_info != null) ...[
                      const SizedBox(height: 14),
                      Text(_info!, style: const TextStyle(color: kKicker)),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_registering ? 'Crear cuenta' : 'Entrar'),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _submitting
                          ? null
                          : () {
                              setState(() {
                                _registering = !_registering;
                                _error = null;
                                _info = null;
                              });
                            },
                      child: Text(
                        _registering
                            ? '¿Ya tienes cuenta? Entra'
                            : '¿No tienes cuenta? Regístrate',
                      ),
                    ),
                    if (widget.onChangeProject != null)
                      TextButton(
                        onPressed: _submitting ? null : _changeProject,
                        child: const Text('Usar otro proyecto de Supabase'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String messageForAuthError(Object error) {
  if (error is AuthRetryableFetchException) {
    return 'No se pudo conectar con Supabase. Revisa la URL y tu conexión.';
  }
  if (error is! AuthException) {
    return 'No se pudo completar la solicitud.';
  }

  switch (error.code) {
    case 'invalid_credentials':
      return 'Correo o contraseña incorrectos.';
    case 'email_not_confirmed':
      return 'Confirma tu correo antes de entrar.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Ese correo ya está registrado.';
    case 'weak_password':
      return 'La contraseña es demasiado débil.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Supabase ya no envía más correos por ahora. Espera cerca de una hora, o desactiva la confirmación por correo en el proyecto.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Supabase no acepta ese correo. Usa una dirección real, como la de Hotmail.';
  }

  final message = error.message.toLowerCase();
  if (message.contains('email rate limit') || message.contains('rate limit')) {
    return 'Supabase ya no envía más correos por ahora. Espera cerca de una hora, o desactiva la confirmación por correo en el proyecto.';
  }
  if (message.contains('invalid') && message.contains('email')) {
    return 'Supabase no acepta ese correo. Usa una dirección real, como la de Hotmail.';
  }
  if (message.contains('invalid api key') || message.contains('invalid jwt')) {
    return 'La clave de Supabase no es válida.';
  }
  if (message.contains('email not confirmed')) {
    return 'Confirma tu correo antes de entrar.';
  }
  if (message.contains('already registered') ||
      message.contains('already been registered')) {
    return 'Ese correo ya está registrado.';
  }
  return error.message;
}
