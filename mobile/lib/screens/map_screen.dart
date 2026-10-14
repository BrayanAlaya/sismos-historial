import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/earthquake.dart';
import '../services/location_sync.dart';
import '../services/push_notifications.dart';
import '../services/quake_alerts.dart';
import '../services/usgs_api.dart';
import '../theme/app_theme.dart';
import '../utils/earthquake_format.dart';
import '../widgets/earthquake_detail_sheet.dart';
import '../widgets/quake_marker_layer.dart';
import '../widgets/safety_tips_sheet.dart';
import 'account_screen.dart';
import 'history_screen.dart';

const _refreshInterval = Duration(seconds: 40);

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with WidgetsBindingObserver {
  final _mapController = MapController();
  late final MapOptions _mapOptions = MapOptions(
    initialCenter: const LatLng(18, 10),
    initialZoom: 2.2,
    minZoom: 1.5,
    maxZoom: 13,
    backgroundColor: kBackground,
    cameraConstraint: const CameraConstraint.containLatitude(),
    interactionOptions: const InteractionOptions(
      flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
    ),
    onTap: _onMapTap,
  );

  final _locationSync = LocationSync(Supabase.instance.client);
  final _alertFeed = QuakeAlertFeed(Supabase.instance.client);
  List<Earthquake> _earthquakes = const [];
  UserPlace? _userPlace;
  var _loading = true;
  String? _error;
  DateTime? _lastUpdated;
  double _minMagnitude = 2.5;
  Timer? _refreshTimer;
  Timer? _locationTimer;
  var _requestId = 0;
  var _presentingAlert = false;
  final _alertQueue = <QuakeAlert>[];
  final _knownAlertIds = <int>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load(isRefresh: false);
    _listenForAlerts();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_openSession());
    });
    _locationTimer = Timer.periodic(
      const Duration(minutes: 3),
      (_) => _syncLocation(),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _syncLocation();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshTimer?.cancel();
    _locationTimer?.cancel();
    _requestId++;
    _mapController.dispose();
    _alertFeed.dispose();
    super.dispose();
  }

  Future<void> _openSession() async {
    await _syncLocation(requestPermission: true);
    if (!mounted) return;
    await startQuakePush();
  }

  Future<void> _syncLocation({bool requestPermission = false}) async {
    final snapshot = await _locationSync.refresh(
      requestPermission: requestPermission,
    );
    if (!mounted) return;
    setState(() => _userPlace = snapshot.showOnMap ? snapshot.place : null);
  }

  Future<void> _listenForAlerts() async {
    try {
      final unseen = await _alertFeed.loadUnseen();
      if (!mounted) return;
      _enqueueAlerts(unseen);
    } catch (_) {}
    _alertFeed.listen((alert) {
      if (!mounted) return;
      _enqueueAlerts([alert]);
    });
  }

  void _enqueueAlerts(List<QuakeAlert> alerts) {
    for (final alert in alerts) {
      if (!_knownAlertIds.add(alert.id)) continue;
      _alertQueue.add(alert);
    }
    _presentNextAlert();
  }

  Future<void> _presentNextAlert() async {
    if (_presentingAlert || _alertQueue.isEmpty || !mounted) return;
    _presentingAlert = true;
    final alert = _alertQueue.removeAt(0);
    await showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Sismo cerca de ti'),
          content: Text(
            '${formatMagnitude(alert.magnitude)} ${alert.distanceLabel}\n${alert.place}',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Entendido'),
            ),
          ],
        );
      },
    );
    try {
      await _alertFeed.markSeen(alert.id);
    } catch (_) {}
    _presentingAlert = false;
    if (mounted) _presentNextAlert();
  }

  void _onMapTap(TapPosition tap, LatLng _) {
    final local = tap.relative;
    if (local == null) return;
    final hit = quakeAtScreenPoint(
      camera: _mapController.camera,
      earthquakes: _earthquakes,
      minMagnitude: _minMagnitude,
      point: local,
    );
    if (hit == null || !mounted) return;
    showEarthquakeDetail(context, hit);
  }

  Future<void> _load({required bool isRefresh}) async {
    final requestId = ++_requestId;
    if (!isRefresh && mounted) {
      setState(() => _loading = true);
    }

    try {
      final data = await fetchEarthquakes();
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _earthquakes = data;
        _error = null;
        _loading = false;
        _lastUpdated = DateTime.now();
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _loading = false;
        _error = error is UsgsException
            ? error.message
            : 'No se pudieron cargar los sismos.';
      });
    } finally {
      if (mounted && requestId == _requestId) {
        _refreshTimer?.cancel();
        _refreshTimer = Timer(_refreshInterval, () => _load(isRefresh: true));
      }
    }
  }

  Future<void> _signOut() async {
    try {
      await stopQuakePush();
      await Supabase.instance.client.auth.signOut();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo cerrar la sesión.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = [
      for (final earthquake in _earthquakes)
        if (earthquake.magnitude >= _minMagnitude) earthquake,
    ];
    final email = Supabase.instance.client.auth.currentUser?.email;
    final userPoint = _userPlace == null
        ? null
        : LatLng(_userPlace!.latitude, _userPlace!.longitude);

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: _mapOptions,
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.sismos.sismos',
              ),
              QuakeMarkerLayer(earthquakes: visible, userPoint: userPoint),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: _TopHud(
                visibleCount: visible.length,
                totalCount: _earthquakes.length,
                loading: _loading,
                email: email,
                lastUpdated: _lastUpdated,
                onSafety: () => showSafetyTips(context),
                onHistory: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (context) => const HistoryScreen(),
                    ),
                  );
                },
                onAccount: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (context) => const AccountScreen(),
                    ),
                  );
                  if (mounted) _syncLocation();
                },
                onSignOut: _signOut,
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: _FilterPanel(
                  minMagnitude: _minMagnitude,
                  lastUpdated: _lastUpdated,
                  error: _error,
                  onChanged: (value) => setState(() => _minMagnitude = value),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopHud extends StatelessWidget {
  const _TopHud({
    required this.visibleCount,
    required this.totalCount,
    required this.loading,
    required this.email,
    required this.lastUpdated,
    required this.onSafety,
    required this.onHistory,
    required this.onAccount,
    required this.onSignOut,
  });

  final int visibleCount;
  final int totalCount;
  final bool loading;
  final String? email;
  final DateTime? lastUpdated;
  final VoidCallback onSafety;
  final VoidCallback onHistory;
  final VoidCallback onAccount;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final status = loading && totalCount == 0
        ? 'Cargando sismos…'
        : '$visibleCount sismos visibles';

    return DecoratedBox(
      decoration: kOverlayDecoration,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'USGS · TIEMPO REAL',
                    style: TextStyle(
                      color: kKicker,
                      fontSize: 11,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Text(
                    'Sismos en el mundo',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  if (email != null)
                    Text(
                      email!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: kMuted, fontSize: 12),
                    ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: loading
                              ? const Color(0xFFF59E0B)
                              : const Color(0xFF22C55E),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          status,
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  _RefreshLine(
                    lastUpdated: lastUpdated,
                    totalCount: totalCount,
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Qué hacer en un sismo',
              onPressed: onSafety,
              icon: const Icon(Icons.health_and_safety_outlined),
            ),
            IconButton(
              tooltip: 'Historial',
              onPressed: onHistory,
              icon: const Icon(Icons.history),
            ),
            IconButton(
              tooltip: 'Tu información',
              onPressed: onAccount,
              icon: const Icon(Icons.settings),
            ),
            IconButton(
              tooltip: 'Cerrar sesión',
              onPressed: onSignOut,
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
      ),
    );
  }
}

class _RefreshLine extends StatefulWidget {
  const _RefreshLine({required this.lastUpdated, required this.totalCount});

  final DateTime? lastUpdated;
  final int totalCount;

  @override
  State<_RefreshLine> createState() => _RefreshLineState();
}

class _RefreshLineState extends State<_RefreshLine> {
  Timer? _timer;
  var _secondsLeft = _refreshInterval.inSeconds;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(
        () => _secondsLeft = (_secondsLeft - 1).clamp(
          0,
          _refreshInterval.inSeconds,
        ),
      );
    });
  }

  @override
  void didUpdateWidget(covariant _RefreshLine oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.lastUpdated != oldWidget.lastUpdated) {
      _secondsLeft = _refreshInterval.inSeconds;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      '${widget.totalCount} en las últimas 24 h · próxima act. ${_secondsLeft}s',
      style: const TextStyle(color: kMuted, fontSize: 12),
    );
  }
}

class _FilterPanel extends StatelessWidget {
  const _FilterPanel({
    required this.minMagnitude,
    required this.lastUpdated,
    required this.error,
    required this.onChanged,
  });

  final double minMagnitude;
  final DateTime? lastUpdated;
  final String? error;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final updated = lastUpdated == null ? '—' : formatClock(lastUpdated!);

    return DecoratedBox(
      decoration: kOverlayDecoration,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Magnitud mínima: ${minMagnitude.toStringAsFixed(1)}'),
            Slider(
              min: 0,
              max: 7,
              divisions: 14,
              value: minMagnitude,
              label: minMagnitude.toStringAsFixed(1),
              onChanged: onChanged,
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final item in dangerLegend) ...[
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: item.color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      item.label,
                      style: const TextStyle(color: kMuted, fontSize: 11),
                    ),
                    const SizedBox(width: 10),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Última actualización: $updated',
              style: const TextStyle(color: kMuted, fontSize: 12),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  error!,
                  style: const TextStyle(
                    color: Color(0xFFF87171),
                    fontSize: 12,
                  ),
                ),
              ),
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () {
                unawaited(
                  launchUrl(
                    Uri.parse('https://www.openstreetmap.org/copyright'),
                    mode: LaunchMode.externalApplication,
                  ),
                );
              },
              child: const Text(
                '© OpenStreetMap · Datos USGS',
                style: TextStyle(
                  color: kMuted,
                  fontSize: 11,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
