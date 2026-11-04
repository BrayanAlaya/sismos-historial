import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sismos/config/supabase_settings.dart';
import 'package:sismos/models/earthquake.dart';
import 'package:sismos/services/quake_alerts.dart';
import 'package:sismos/services/test_quake.dart';
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

  test('Peru bounds, sound and priority advice match the web rules', () {
    expect(isInPeru(-7.157, -78.517), isTrue);
    expect(isInPeru(-12.046, -77.043), isTrue);
    expect(isInPeru(-33.45, -70.67), isFalse);
    expect(shouldSoundForMagnitude(3.9), isFalse);
    expect(shouldSoundForMagnitude(4), isTrue);
    expect(priorityRecommendations(2.5).first, contains('Mantén la calma'));
    expect(priorityRecommendations(4.8).first, contains('Agáchate'));
    expect(priorityRecommendations(6.4).join(' '), contains('tsunami'));
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

  test('una prueba reciente entra al mapa y conserva su puesto en el historial', () {
    final now = DateTime.utc(2026, 11, 3, 18);
    final recent = SimulatedQuake(
      id: 'sim-reciente',
      magnitude: 4.8,
      place: 'Prueba sísmica',
      time: now.millisecondsSinceEpoch - 60000,
      latitude: -7.1569,
      longitude: -78.5176,
      depth: 30,
    );
    final stored = simulatedQuakeFromJson({
      'id': recent.id,
      'magnitude': recent.magnitude,
      'place': recent.place,
      'time': recent.time,
      'latitude': recent.latitude,
      'longitude': recent.longitude,
      'depth': recent.depth,
    });
    expect(stored?.id, recent.id);
    expect(simulatedQuakeFromJson({'id': 'rota'}), isNull);

    final quakes = mergeFeedQuakes(
      [
        Earthquake(
          id: 'us1',
          magnitude: 3.1,
          place: 'Chile',
          title: 'M 3.1',
          time: now.millisecondsSinceEpoch - 120000,
          updated: now.millisecondsSinceEpoch,
          url: '',
          felt: null,
          cdi: null,
          mmi: null,
          alert: null,
          status: 'automatic',
          tsunami: 0,
          significance: 100,
          magType: 'ml',
          type: 'earthquake',
          longitude: -70,
          latitude: -33,
          depth: 20,
        ),
      ],
      [
        recent,
        SimulatedQuake(
          id: 'sim-futura',
          magnitude: 4.8,
          place: 'Prueba sísmica',
          time: now.millisecondsSinceEpoch + 60000,
          latitude: -7.1,
          longitude: -78.5,
          depth: 10,
        ),
      ],
      now: now,
    );

    expect(quakes.first.id, recent.id);
    expect(quakes.first.place, 'Prueba sísmica');
    expect(quakes.first.magnitude, 4.8);
    expect(quakes.first.latitude, -7.1569);
    expect(quakes.first.longitude, -78.5176);
    expect(quakes.first.depth, 30);
    expect(isRecent(quakes.first, now: now), isTrue);
    expect(quakes, hasLength(2));
    expect(mergeFeedQuakes(quakes, const [], now: now), quakes);

    final newer = Earthquake(
      id: 'us-nuevo',
      magnitude: 5,
      place: 'Perú',
      title: 'M 5.0',
      time: recent.time + 5000,
      updated: recent.time,
      url: '',
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      status: 'automatic',
      tsunami: 0,
      significance: 300,
      magType: 'ml',
      type: 'earthquake',
      longitude: -77,
      latitude: -12,
      depth: 15,
    );
    final page = assembleHistoryPage(
      usgs: [newer],
      simulated: [earthquakeFromSimulation(recent)!],
      indexes: {recent.id: simulationIndex(recent, [recent], 1)},
      page: 1,
      pageSize: 2,
    );
    expect(page.map((item) => item.id), ['us-nuevo', recent.id]);
  });

  test('la alerta cercana describe el sismo y pide las recomendaciones', () {
    final now = DateTime.utc(2026, 10, 20, 18);
    final alert = QuakeAlert(
      id: 1,
      magnitude: 4.8,
      place: 'Cajamarca, Cajamarca, Peru',
      distanceKm: 0,
      quakeTime: now.subtract(const Duration(seconds: 20)),
    );

    expect(
      describeQuakeAlert(alert, now: now),
      'Se registró un sismo moderado de M 4.8 a 0 m de tu última ubicación, '
      'en Cajamarca, Cajamarca, Peru. Ocurrió hace unos segundos. '
      'Al aceptar verás qué hacer antes, durante y después de un sismo.',
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
