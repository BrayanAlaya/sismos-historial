import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/supabase_settings.dart';
import '../models/earthquake.dart';
import 'test_quake.dart';

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
  final responseFuture = http
      .get(Uri.parse(usgsFeedUrl), headers: _headers)
      .timeout(const Duration(seconds: 25));
  final simulationsFuture = fetchSimulatedQuakes();
  final response = await responseFuture;
  final simulations = await simulationsFuture;

  if (response.statusCode != 200) {
    throw UsgsException('No se pudieron cargar los sismos de USGS');
  }

  final quakes = mergeFeedQuakes(_parseFeatures(response.body), simulations);
  quakes.sort((a, b) => b.time.compareTo(a.time));
  return quakes;
}

Future<List<SimulatedQuake>> fetchSimulatedQuakes() async {
  try {
    final settings = SupabaseSettings.fromDefines();
    if (!settings.isConfigured) return const [];
    final response = await http
        .get(
          Uri.parse('${settings.url}/functions/v1/test-quakes'),
          headers: {
            ..._headers,
            'apikey': settings.anonKey,
            'Authorization': 'Bearer ${settings.anonKey}',
          },
        )
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) return const [];
    final decoded = jsonDecode(response.body);
    if (decoded is! Map || decoded['quakes'] is! List) return const [];
    return [
      for (final item in decoded['quakes'] as List)
        if (item is Map) ?simulatedQuakeFromJson(Map<String, dynamic>.from(item)),
    ];
  } catch (_) {
    return const [];
  }
}

Future<List<Earthquake>> fetchEarthquakeHistory({
  required int page,
  required int pageSize,
  DateTime? now,
}) async {
  final clock = now ?? DateTime.now();
  final simulations = [
    for (final sim in await fetchSimulatedQuakes())
      if (isInHistoryWindow(sim.time, clock, days: historyDays)) sim,
  ];

  var offset = (page - 1) * pageSize + 1;
  var limit = pageSize;
  final indexes = <String, int>{};
  if (simulations.isNotEmpty) {
    final newer = await Future.wait([
      for (final sim in simulations) _countEventsAfter(sim.time),
    ]);
    for (var i = 0; i < simulations.length; i++) {
      indexes[simulations[i].id] = simulationIndex(
        simulations[i],
        simulations,
        newer[i],
      );
    }
    final slice = usgsSliceForPage(page, pageSize, indexes.values);
    offset = slice.offset;
    limit = slice.limit;
  }

  final usgs = <Earthquake>[];
  if (limit > 0) {
    final response = await http
        .get(
          buildHistoryQueryUri(
            page: page,
            pageSize: pageSize,
            now: clock,
            offset: offset,
            limit: limit,
          ),
          headers: _headers,
        )
        .timeout(const Duration(seconds: 25));

    if (response.statusCode != 200) {
      throw UsgsException('No se pudo cargar el historial de USGS');
    }
    final blocked = simulations.map((sim) => sim.id).toSet();
    usgs.addAll(
      _parseFeatures(response.body).where((quake) => !blocked.contains(quake.id)),
    );
  }

  if (simulations.isEmpty) return usgs;
  return assembleHistoryPage(
    usgs: usgs,
    simulated: [
      for (final sim in simulations) ?earthquakeFromSimulation(sim),
    ],
    indexes: indexes,
    page: page,
    pageSize: pageSize,
  );
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

  final clock = now ?? DateTime.now();
  final extra = (await fetchSimulatedQuakes())
      .where((sim) => isInHistoryWindow(sim.time, clock, days: historyDays))
      .length;
  final total = count + extra;
  return total < historyMaxEvents ? total : historyMaxEvents;
}

Uri buildHistoryQueryUri({
  required int page,
  required int pageSize,
  DateTime? now,
  int? offset,
  int? limit,
}) {
  final resolvedOffset = offset ?? ((page - 1) * pageSize + 1);
  return Uri.parse(usgsQueryUrl).replace(
    queryParameters: {
      ..._historyParams(now),
      'format': 'geojson',
      'orderby': 'time',
      'limit': '${limit ?? pageSize}',
      'offset': '$resolvedOffset',
      'jsonerror': 'true',
    },
  );
}

Uri buildHistoryCountUri({DateTime? now}) {
  return Uri.parse(usgsCountUrl).replace(queryParameters: _historyParams(now));
}

Map<String, String> _historyParams(DateTime? now) {
  return {
    'eventtype': 'earthquake',
    'starttime': historyStart(now ?? DateTime.now(), days: historyDays).toIso8601String(),
  };
}

Future<int> _countEventsAfter(int timeMs) async {
  final start = DateTime.fromMillisecondsSinceEpoch(timeMs + 1, isUtc: true);
  final uri = Uri.parse(usgsCountUrl).replace(
    queryParameters: {
      'eventtype': 'earthquake',
      'starttime': start.toIso8601String(),
    },
  );
  final response = await http.get(uri, headers: _headers).timeout(const Duration(seconds: 25));
  if (response.statusCode != 200) {
    throw UsgsException('No se pudo ubicar la prueba en el historial');
  }
  final count = int.tryParse(response.body.trim());
  if (count == null) {
    throw UsgsException('No se pudo ubicar la prueba en el historial');
  }
  return count;
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
