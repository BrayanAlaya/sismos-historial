import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth_screen.dart';
import 'map_screen.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key, this.onChangeProject});

  final Future<void> Function()? onChangeProject;

  @override
  Widget build(BuildContext context) {
    final client = Supabase.instance.client;
    return StreamBuilder<AuthState>(
      stream: client.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = snapshot.hasData
            ? snapshot.data!.session
            : client.auth.currentSession;
        if (session == null) {
          return AuthScreen(onChangeProject: onChangeProject);
        }
        return const MapScreen();
      },
    );
  }
}
