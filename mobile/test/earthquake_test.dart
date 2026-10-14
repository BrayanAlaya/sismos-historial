import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sismos/config/supabase_settings.dart';
import 'package:sismos/models/earthquake.dart';
import 'package:sismos/services/usgs_api.dart';
import 'package:sismos/utils/earthquake_format.dart';

void main() {
  test('maps a USGS feature and drops events without geometry', () {
    final earthquake = earthquakeFromFeature({
      'id': 'us123',
      'properties': {
        'mag': 5.4,
        'place': '10 km al oeste de Lima',
        'time': 1_700_000_000_000,
        'updated': 1_700_000_100_000,
        'url': 'https://earthquake.usgs.gov/earthquakes/eventpage/us123',
        'felt': 1200,
        'cdi': 3.2,
        'mmi': 4,
        'alert': null,
        'status': 'reviewed',
        'tsunami': 0,
        'sig': 400,
        'magType': 'mww',
        'type': 'earthquake',
        'title': 'M 5.4 - Lima',
      },
      'geometry': {
        'type': 'Point',
        'coordinates': [-77.1, -12.05, 35.2],
      },
    });

    expect(earthquake, isNotNull);
    expect(earthquake!.id, 'us123');
    expect(earthquake.magnitude, 5.4);
    expect(earthquake.place, '10 km al oeste de Lima');
    expect(earthquake.depth, 35.2);
    expect(earthquake.mmi, 4);
    expect(
      earthquakeFromFeature({
        'properties': {'mag': 2},
        'geometry': null,
      }),
      isNull,
    );
  });

  test('danger levels follow the same cuts as the web app', () {
    expect(dangerLevelFor(7).label, 'Extremo');
    expect(dangerLevelFor(6).label, 'Muy fuerte');
    expect(dangerLevelFor(5).label, 'Fuerte');
    expect(dangerLevelFor(4).label, 'Moderado');
    expect(dangerLevelFor(3).label, 'Leve');
    expect(dangerLevelFor(2.9).label, 'Menor');
    expect(formatMagnitude(4.26), 'M 4.3');
  });

  test('relative time and history range use Spanish labels', () {
    final now = DateTime.utc(2026, 9, 22, 12);
    expect(
      formatRelativeTime(now.subtract(const Duration(seconds: 20)).millisecondsSinceEpoch, now: now),
      'hace unos segundos',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(minutes: 5)).millisecondsSinceEpoch, now: now),
      'hace 5 min',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(hours: 3)).millisecondsSinceEpoch, now: now),
      'hace 3 h',
    );
    expect(
      formatRelativeTime(now.subtract(const Duration(days: 2)).millisecondsSinceEpoch, now: now),
      'hace 2 d',
    );
    expect(formatThousands(12345), '12.345');
    expect(
      historyRangeLabel(total: 12345, page: 2, pageSize: 10, loadedCount: 10),
      '11–20 de 12.345',
    );
  });

  test('history query uses a 30 day window and 1-based offset', () {
    final uri = buildHistoryQueryUri(
      page: 2,
      pageSize: 10,
      now: DateTime.utc(2026, 9, 22),
    );

    expect(uri.queryParameters['eventtype'], 'earthquake');
    expect(uri.queryParameters['format'], 'geojson');
    expect(uri.queryParameters['orderby'], 'time');
    expect(uri.queryParameters['limit'], '10');
    expect(uri.queryParameters['offset'], '11');
    expect(
      uri.queryParameters['starttime'],
      DateTime.utc(2026, 8, 23).toIso8601String(),
    );
  });

  test('supabase settings reject http urls and secret keys', () {
    expect(
      const SupabaseSettings(
        url: 'https://demo.supabase.co',
        anonKey: 'abcdefghijklmnopqrst',
      ).isConfigured,
      isTrue,
    );
    expect(
      const SupabaseSettings(
        url: 'http://demo.supabase.co',
        anonKey: 'abcdefghijklmnopqrst',
      ).isConfigured,
      isFalse,
    );

    final secret = _jwt('{"role":"service_role"}');
    expect(looksLikeSecretKey(secret), isTrue);
    expect(looksLikeSecretKey('sb_secret_example'), isTrue);
    expect(
      SupabaseSettings(url: 'https://demo.supabase.co', anonKey: secret).isConfigured,
      isFalse,
    );
  });
}

String _jwt(String payload) {
  String part(String value) => base64Url.encode(utf8.encode(value)).replaceAll('=', '');
  return '${part('{"alg":"none"}')}.${part(payload)}.sig';
}
