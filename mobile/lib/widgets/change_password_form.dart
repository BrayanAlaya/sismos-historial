import 'package:flutter/material.dart';

import '../services/password_change.dart';
import '../theme/app_theme.dart';

class ChangePasswordForm extends StatefulWidget {
  const ChangePasswordForm({super.key, required this.onSubmit});

  final Future<void> Function(String currentPassword, String newPassword) onSubmit;

  @override
  State<ChangePasswordForm> createState() => _ChangePasswordFormState();
}

class _ChangePasswordFormState extends State<ChangePasswordForm> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _nextController = TextEditingController();
  final _confirmController = TextEditingController();
  var _submitting = false;
  var _obscure = true;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _currentController.dispose();
    _nextController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
      _info = null;
    });

    try {
      await widget.onSubmit(_currentController.text, _nextController.text);
      if (!mounted) return;
      _currentController.clear();
      _nextController.clear();
      _confirmController.clear();
      setState(() => _info = 'Contraseña actualizada.');
    } on PasswordChangeException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo cambiar la contraseña.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'CONTRASEÑA',
            style: TextStyle(
              color: kKicker,
              fontSize: 11,
              letterSpacing: 1.1,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Para cambiarla, confirma la actual y escribe la nueva dos veces.',
            style: TextStyle(color: kMuted),
          ),
          const SizedBox(height: 14),
          _PasswordField(
            fieldKey: const Key('current-password'),
            controller: _currentController,
            label: 'Contraseña actual',
            enabled: !_submitting,
            obscure: _obscure,
            onToggle: _toggleObscure,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.password],
            validator: currentPasswordIssue,
          ),
          const SizedBox(height: 12),
          _PasswordField(
            fieldKey: const Key('new-password'),
            controller: _nextController,
            label: 'Nueva contraseña',
            enabled: !_submitting,
            obscure: _obscure,
            onToggle: _toggleObscure,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            validator: (value) =>
                newPasswordIssue(value ?? '', _currentController.text),
          ),
          const SizedBox(height: 12),
          _PasswordField(
            fieldKey: const Key('confirm-password'),
            controller: _confirmController,
            label: 'Confirmar nueva contraseña',
            enabled: !_submitting,
            obscure: _obscure,
            onToggle: _toggleObscure,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            autofillHints: const [AutofillHints.newPassword],
            validator: (value) =>
                confirmPasswordIssue(value ?? '', _nextController.text),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFFF87171))),
          ],
          if (_info != null) ...[
            const SizedBox(height: 12),
            Text(_info!, style: const TextStyle(color: kKicker)),
          ],
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Guardar contraseña'),
          ),
        ],
      ),
    );
  }

  void _toggleObscure() => setState(() => _obscure = !_obscure);
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.fieldKey,
    required this.controller,
    required this.label,
    required this.enabled,
    required this.obscure,
    required this.onToggle,
    required this.validator,
    required this.textInputAction,
    required this.autofillHints,
    this.onSubmitted,
  });

  final Key fieldKey;
  final TextEditingController controller;
  final String label;
  final bool enabled;
  final bool obscure;
  final VoidCallback onToggle;
  final FormFieldValidator<String> validator;
  final TextInputAction textInputAction;
  final Iterable<String> autofillHints;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: fieldKey,
      controller: controller,
      enabled: enabled,
      obscureText: obscure,
      autofillHints: autofillHints,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmitted,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: IconButton(
          onPressed: enabled ? onToggle : null,
          icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
        ),
      ),
      validator: validator,
    );
  }
}
