import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/location_sync.dart';
import '../services/push_notifications.dart';
import '../theme/app_theme.dart';
import '../utils/earthquake_format.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _sync = LocationSync(Supabase.instance.client);
  LocationSnapshot? _snapshot;
  QuakePushStatus? _pushStatus;
  var _busy = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _reload(requestPermission: false);
    });
  }

  Future<void> _reload({required bool requestPermission}) async {
    setState(() => _busy = true);
    final snapshot = await _sync.refresh(requestPermission: requestPermission);
    final pushStatus = await quakePushStatus();
    if (!mounted) return;
    setState(() {
      _snapshot = snapshot;
      _pushStatus = pushStatus;
      _busy = false;
    });
  }

  Future<void> _enableNotifications() async {
    setState(() => _busy = true);
    await startQuakePush();
    final pushStatus = await quakePushStatus();
    if (!mounted) return;
    setState(() {
      _pushStatus = pushStatus;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final snapshot = _snapshot;
    final place = snapshot?.place;

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'CUENTA',
              style: TextStyle(
                color: kKicker,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text('Tu información', style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Text(
            user?.email ?? 'Sin correo',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          const Text(
            'La última ubicación se guarda solo con internet y el servicio de ubicación encendido. Sirve para avisarte si hay un sismo cerca.',
            style: TextStyle(color: kMuted),
          ),
          const SizedBox(height: 22),
          const Text(
            'NOTIFICACIONES',
            style: TextStyle(
              color: kKicker,
              fontSize: 11,
              letterSpacing: 1.1,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _busy || _pushStatus == null
                ? 'Consultando…'
                : quakePushStatusLabel(_pushStatus!),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          if (_pushStatus == QuakePushStatus.disabled) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _enableNotifications,
              child: const Text('Activar notificaciones'),
            ),
          ],
          const SizedBox(height: 22),
          const Text(
            'UBICACIÓN',
            style: TextStyle(
              color: kKicker,
              fontSize: 11,
              letterSpacing: 1.1,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _busy ? 'Consultando…' : (snapshot?.statusLabel ?? 'Sin consultar'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          if (place != null) ...[
            const SizedBox(height: 8),
            Text(
              formatCoordinates(place.latitude, place.longitude),
              style: const TextStyle(color: kMuted),
            ),
            if (place.updatedAt != null)
              Text(
                'Último guardado: ${formatClock(place.updatedAt!)}',
                style: const TextStyle(color: kMuted, fontSize: 13),
              ),
          ],
          if (snapshot?.message != null) ...[
            const SizedBox(height: 10),
            Text(
              snapshot!.message!,
              style: const TextStyle(color: Color(0xFFF87171)),
            ),
          ],
          const SizedBox(height: 20),
          if (snapshot != null && !snapshot.permissionBlocked)
            FilledButton(
              onPressed: _busy
                  ? null
                  : () =>
                        _reload(requestPermission: !snapshot.permissionGranted),
              child: Text(
                snapshot.permissionGranted
                    ? 'Actualizar ubicación'
                    : 'Permitir ubicación',
              ),
            ),
          if (snapshot != null && snapshot.permissionBlocked)
            FilledButton(
              onPressed: _busy
                  ? null
                  : () {
                      Geolocator.openAppSettings();
                    },
              child: const Text('Abrir ajustes del sistema'),
            ),
          if (snapshot != null &&
              snapshot.permissionGranted &&
              !snapshot.serviceEnabled)
            TextButton(
              onPressed: _busy
                  ? null
                  : () {
                      Geolocator.openLocationSettings();
                    },
              child: const Text('Activar servicio de ubicación'),
            ),
        ],
      ),
    );
  }
}
