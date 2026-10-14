import 'package:flutter/material.dart';

import '../config/supabase_bootstrap.dart';
import '../config/supabase_settings.dart';
import '../theme/app_theme.dart';

class SetupScreen extends StatefulWidget {
  const SetupScreen({
    super.key,
    this.initialUrl = '',
    this.initialKey = '',
    this.startupError,
    required this.onConnected,
  });

  final String initialUrl;
  final String initialKey;
  final String? startupError;
  final VoidCallback onConnected;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  late final TextEditingController _urlController;
  late final TextEditingController _keyController;
  var _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.initialUrl);
    _keyController = TextEditingController(text: widget.initialKey);
    _error = widget.startupError;
  }

  @override
  void dispose() {
    _urlController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final settings = SupabaseSettings(
      url: _urlController.text,
      anonKey: _keyController.text,
    );

    if (looksLikeSecretKey(settings.anonKey)) {
      setState(() {
        _error = 'Esa parece la clave secreta. Usa la anon o publishable.';
      });
      return;
    }

    if (!settings.isConfigured) {
      setState(() {
        _error = 'Pega una URL https y la clave anon del proyecto.';
      });
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await settings.save();
      await connectSupabase(settings);
      if (!mounted) return;
      widget.onConnected();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No se pudo conectar. Revisa la URL y la clave.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'SUPABASE',
                    style: TextStyle(
                      color: kKicker,
                      fontSize: 12,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Conecta el proyecto',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'En Supabase abre Project Settings → API y copia la Project URL y la clave anon (o publishable). En Authentication → Providers deja Email activado.',
                    style: TextStyle(color: kMuted, height: 1.4),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'No uses la clave secret ni service_role: esta app corre en el teléfono.',
                    style: TextStyle(color: kMuted, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _urlController,
                    keyboardType: TextInputType.url,
                    autocorrect: false,
                    enabled: !_saving,
                    decoration: const InputDecoration(
                      labelText: 'Project URL',
                      hintText: 'https://tu-proyecto.supabase.co',
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _keyController,
                    autocorrect: false,
                    enableSuggestions: false,
                    enabled: !_saving,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Clave anon',
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Text(_error!, style: const TextStyle(color: Color(0xFFF87171))),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Continuar'),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'También puedes definir SUPABASE_URL y SUPABASE_ANON_KEY al arrancar: flutter run --dart-define-from-file=env.json',
                    style: TextStyle(color: kMuted, fontSize: 12, height: 1.4),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
