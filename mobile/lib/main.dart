import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'config/supabase_bootstrap.dart';
import 'config/supabase_settings.dart';
import 'screens/auth_gate.dart';
import 'screens/setup_screen.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');

  final settings = await SupabaseSettings.load();
  var connected = false;
  String? startupError;

  if (settings.isConfigured) {
    try {
      await connectSupabase(settings);
      connected = true;
    } catch (_) {
      startupError = 'No se pudo conectar. Revisa la URL y la clave.';
    }
  }

  runApp(
    SismosApp(
      settings: settings,
      connected: connected,
      startupError: startupError,
    ),
  );
}

class SismosApp extends StatefulWidget {
  const SismosApp({
    super.key,
    required this.settings,
    required this.connected,
    this.startupError,
  });

  final SupabaseSettings settings;
  final bool connected;
  final String? startupError;

  @override
  State<SismosApp> createState() => _SismosAppState();
}

class _SismosAppState extends State<SismosApp> {
  late bool _connected = widget.connected;
  late SupabaseSettings _settings = widget.settings;
  String? _startupError;

  @override
  void initState() {
    super.initState();
    _startupError = widget.startupError;
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sismos',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: _connected
          ? AuthGate(
              onChangeProject: _settings.fromEnvironment
                  ? null
                  : () async {
                      setState(() {
                        _connected = false;
                        _settings = const SupabaseSettings(url: '', anonKey: '');
                        _startupError = null;
                      });
                    },
            )
          : SetupScreen(
              key: ValueKey('${_settings.url}:${_startupError ?? ''}'),
              initialUrl: _settings.url,
              initialKey: _settings.anonKey,
              startupError: _startupError,
              onConnected: () {
                setState(() {
                  _connected = true;
                  _startupError = null;
                });
              },
            ),
    );
  }
}
