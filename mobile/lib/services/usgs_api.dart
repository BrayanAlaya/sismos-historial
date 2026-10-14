import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/earthquake.dart';

const usgsFeedUrl =
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const usgsQueryUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const usgsCountUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/count';
const historyMaxEvents = 20000;
const historyDays = 30;

class UsgsException implements Exception {
  UsgsException(this.message);

  final String message;
}

const _headers = {'User-Agent': 'sismos-mobile/1.0'};

Future<List<Earthquake>> fetchEarthquakes() async {
  final response = await http
      .get(Uri.parse(usgsFeedUrl), headers: _headers)
      .timeout(const Duration(seconds: 25));

  if (response.statusCode != 200) {
    throw UsgsException('No se pudieron cargar los sismos de USGS');
  }

  return _parseFeatures(response.body)..sort((a, b) => b.time.compareTo(a.time));
}

Future<List<Earthquake>> fetchEarthquakeHistory({
  required int page,
  required int pageSize,
  DateTime? now,
}) async {
  final response = await http
      .get(
        buildHistoryQueryUri(page: page, pageSize: pageSize, now: now),
        headers: _headers,
      )
      .timeout(const Duration(seconds: 25));

  if (response.statusCode != 200) {
    throw UsgsException('No se pudo cargar el historial de USGS');
  }

  return _parseFeatures(response.body);
}

Future<int> fetchEarthquakeHistoryCount({DateTime? now}) async {
  final response = await http
      .get(buildHistoryCountUri(now: now), headers: _headers)
      .timeout(const Duration(seconds: 25));

  if (response.statusCode != 200) {
    throw UsgsException('No se pudo contar el historial de USGS');
  }

  final count = int.tryParse(response.body.trim());
  if (count == null) {
    throw UsgsException('La cuenta de sismos no es válida');
  }

  return count < historyMaxEvents ? count : historyMaxEvents;
}

Uri buildHistoryQueryUri({
  required int page,
  required int pageSize,
  DateTime? now,
}) {
  final offset = (page - 1) * pageSize + 1;
  return Uri.parse(usgsQueryUrl).replace(
    queryParameters: {
      ..._historyParams(now),
      'format': 'geojson',
      'orderby': 'time',
      'limit': '$pageSize',
      'offset': '$offset',
      'jsonerror': 'true',
    },
  );
}

Uri buildHistoryCountUri({DateTime? now}) {
  return Uri.parse(usgsCountUrl).replace(queryParameters: _historyParams(now));
}

Map<String, String> _historyParams(DateTime? now) {
  final clock = (now ?? DateTime.now()).toUtc();
  final start = clock.subtract(const Duration(days: historyDays));
  return {
    'eventtype': 'earthquake',
    'starttime': start.toIso8601String(),
  };
}

List<Earthquake> _parseFeatures(String body) {
  final decoded = jsonDecode(body);
  if (decoded is! Map) {
    throw UsgsException('La respuesta de USGS no es válida');
  }

  final features = decoded['features'];
  if (features is! List) return const [];

  return [
    for (final feature in features)
      if (feature is Map)
        ?earthquakeFromFeature(Map<String, dynamic>.from(feature)),
  ];
}
