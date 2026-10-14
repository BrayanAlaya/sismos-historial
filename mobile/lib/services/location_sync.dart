import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class UserPlace {
  const UserPlace({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.updatedAt,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final DateTime? updatedAt;

  factory UserPlace.fromRow(Map<String, dynamic> row) {
    return UserPlace(
      latitude: (row['latitude'] as num).toDouble(),
      longitude: (row['longitude'] as num).toDouble(),
      accuracyMeters: (row['accuracy_m'] as num?)?.toDouble(),
      updatedAt: DateTime.tryParse('${row['updated_at']}')?.toLocal(),
    );
  }
}

class LocationSnapshot {
  const LocationSnapshot({
    required this.permissionGranted,
    required this.permissionBlocked,
    required this.serviceEnabled,
    required this.online,
    this.place,
    this.message,
  });

  final bool permissionGranted;
  final bool permissionBlocked;
  final bool serviceEnabled;
  final bool online;
  final UserPlace? place;
  final String? message;

  bool get showOnMap => permissionGranted && place != null;

  String get statusLabel {
    if (permissionBlocked) return 'Bloqueada en el sistema';
    if (!permissionGranted) return 'No aceptada';
    if (!serviceEnabled) return 'Aceptada · servicio de ubicación apagado';
    if (!online) return 'Aceptada · sin internet, no se guardó';
    return 'Aceptada';
  }
}

class LocationSync {
  LocationSync(this._client);

  final SupabaseClient _client;

  Future<bool> get _online async {
    final results = await Connectivity().checkConnectivity();
    return results.any((result) => result != ConnectivityResult.none);
  }

  Future<LocationSnapshot> refresh({required bool requestPermission}) async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    var permission = await Geolocator.checkPermission();
    if (requestPermission && permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    final granted =
        permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
    final blocked = permission == LocationPermission.deniedForever;
    final online = await _online;

    if (!granted) {
      await _setEnabled(false);
      return LocationSnapshot(
        permissionGranted: false,
        permissionBlocked: blocked,
        serviceEnabled: serviceEnabled,
        online: online,
      );
    }

    final saved = await _loadSaved();
    if (!serviceEnabled) {
      return LocationSnapshot(
        permissionGranted: true,
        permissionBlocked: false,
        serviceEnabled: false,
        online: online,
        place: saved,
        message: 'Activa la ubicación del sistema para actualizar el punto.',
      );
    }
    if (!online) {
      return LocationSnapshot(
        permissionGranted: true,
        permissionBlocked: false,
        serviceEnabled: true,
        online: false,
        place: saved,
        message: 'Sin internet. La última ubicación no se guardó.',
      );
    }

    try {
      final position = await _readPosition();
      if (position == null) {
        return LocationSnapshot(
          permissionGranted: true,
          permissionBlocked: false,
          serviceEnabled: true,
          online: true,
          place: saved,
          message: saved == null
              ? 'No se pudo leer la ubicación.'
              : 'No se pudo actualizar. Se muestra la última conocida.',
        );
      }
      final place = UserPlace(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        updatedAt: position.timestamp,
      );
      await _upsert(place);
      return LocationSnapshot(
        permissionGranted: true,
        permissionBlocked: false,
        serviceEnabled: true,
        online: true,
        place: place,
      );
    } catch (error) {
      return LocationSnapshot(
        permissionGranted: true,
        permissionBlocked: false,
        serviceEnabled: true,
        online: true,
        place: saved,
        message: _saveMessage(error),
      );
    }
  }

  Future<Position?> _readPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      );
    } on TimeoutException {
      return Geolocator.getLastKnownPosition();
    }
  }

  Future<UserPlace?> _loadSaved() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return null;
    try {
      final row = await _client
          .from('user_locations')
          .select()
          .eq('user_id', userId)
          .maybeSingle();
      if (row == null) return null;
      return UserPlace.fromRow(row);
    } catch (_) {
      return null;
    }
  }

  Future<void> _upsert(UserPlace place) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return;
    await _client.from('user_locations').upsert({
      'user_id': userId,
      'latitude': place.latitude,
      'longitude': place.longitude,
      'accuracy_m': place.accuracyMeters,
      'location_enabled': true,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  Future<void> _setEnabled(bool enabled) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return;
    try {
      await _client
          .from('user_locations')
          .update({
            'location_enabled': enabled,
            'updated_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('user_id', userId);
    } catch (_) {}
  }

  String _saveMessage(Object error) {
    if (error is PostgrestException) {
      return 'No se pudo guardar la ubicación. Revisa que la tabla exista en Supabase.';
    }
    return 'No se pudo leer la ubicación.';
  }
}
