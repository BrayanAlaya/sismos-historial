import 'package:supabase_flutter/supabase_flutter.dart';

class QuakeAlert {
  const QuakeAlert({
    required this.id,
    required this.magnitude,
    required this.place,
    required this.distanceKm,
  });

  final int id;
  final double magnitude;
  final String place;
  final double distanceKm;

  factory QuakeAlert.fromRow(Map<String, dynamic> row) {
    return QuakeAlert(
      id: (row['id'] as num).toInt(),
      magnitude: (row['magnitude'] as num).toDouble(),
      place: '${row['place']}',
      distanceKm: (row['distance_km'] as num).toDouble(),
    );
  }

  String get distanceLabel {
    if (distanceKm < 1) {
      return 'a ${(distanceKm * 1000).round()} m';
    }
    return 'a ${distanceKm.toStringAsFixed(1)} km';
  }
}

class QuakeAlertFeed {
  QuakeAlertFeed(this._client);

  final SupabaseClient _client;
  RealtimeChannel? _channel;

  Future<List<QuakeAlert>> loadUnseen() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return const [];
    final rows = await _client
        .from('quake_alerts')
        .select()
        .eq('user_id', userId)
        .isFilter('seen_at', null)
        .order('distance_km');
    return [
      for (final row in rows)
        QuakeAlert.fromRow(Map<String, dynamic>.from(row)),
    ];
  }

  void listen(void Function(QuakeAlert alert) onAlert) {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return;
    _channel = _client
        .channel('quake-alerts-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'quake_alerts',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) {
            onAlert(QuakeAlert.fromRow(payload.newRecord));
          },
        )
        .subscribe();
  }

  Future<void> markSeen(int id) async {
    await _client
        .from('quake_alerts')
        .update({'seen_at': DateTime.now().toUtc().toIso8601String()})
        .eq('id', id);
  }

  Future<void> dispose() async {
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      await _client.removeChannel(channel);
    }
  }
}
