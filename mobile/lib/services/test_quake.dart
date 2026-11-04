import '../models/earthquake.dart';

const feedWindowMs = 24 * 60 * 60 * 1000;

class SimulatedQuake {
  const SimulatedQuake({
    required this.id,
    required this.magnitude,
    required this.place,
    required this.time,
    required this.latitude,
    required this.longitude,
    required this.depth,
  });

  final String id;
  final double magnitude;
  final String place;
  final int time;
  final double latitude;
  final double longitude;
  final double depth;
}

class UsgsSlice {
  const UsgsSlice({required this.offset, required this.limit});

  final int offset;
  final int limit;
}

DateTime historyStart(DateTime now, {int days = 30}) {
  return now.toUtc().subtract(Duration(days: days));
}

bool isInFeedWindow(int timeMs, DateTime now) {
  final nowMs = now.millisecondsSinceEpoch;
  return timeMs <= nowMs && nowMs - timeMs <= feedWindowMs;
}

bool isInHistoryWindow(int timeMs, DateTime now, {int days = 30}) {
  final start = historyStart(now, days: days).millisecondsSinceEpoch;
  final nowMs = now.toUtc().millisecondsSinceEpoch;
  return timeMs <= nowMs && timeMs >= start;
}

SimulatedQuake? simulatedQuakeFromJson(Map<String, dynamic> json) {
  final id = json['id'];
  final magnitude = _asDouble(json['magnitude']);
  final place = json['place'];
  final time = _asInt(json['time']);
  final latitude = _asDouble(json['latitude']);
  final longitude = _asDouble(json['longitude']);
  final depth = _asDouble(json['depth']);
  if (id is! String ||
      id.isEmpty ||
      place is! String ||
      place.isEmpty ||
      magnitude == null ||
      time == null ||
      latitude == null ||
      longitude == null ||
      depth == null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180) {
    return null;
  }
  return SimulatedQuake(
    id: id,
    magnitude: magnitude,
    place: place,
    time: time,
    latitude: latitude,
    longitude: longitude,
    depth: depth,
  );
}

Earthquake? earthquakeFromSimulation(SimulatedQuake sim) {
  final magnitude = (sim.magnitude * 10).round() / 10;
  return earthquakeFromFeature({
    'id': sim.id,
    'properties': {
      'mag': magnitude,
      'place': sim.place,
      'time': sim.time,
      'updated': sim.time,
      'url': '',
      'felt': null,
      'cdi': null,
      'mmi': null,
      'alert': null,
      'status': 'automatic',
      'tsunami': 0,
      'sig': (magnitude * magnitude * 15).round(),
      'magType': 'ml',
      'type': 'earthquake',
      'title': 'M ${magnitude.toStringAsFixed(1)} - ${sim.place}',
    },
    'geometry': {
      'type': 'Point',
      'coordinates': [sim.longitude, sim.latitude, sim.depth],
    },
  });
}

List<Earthquake> mergeFeedQuakes(
  List<Earthquake> quakes,
  List<SimulatedQuake> simulations, {
  DateTime? now,
}) {
  final clock = now ?? DateTime.now();
  final extras = <Earthquake>[];
  for (final sim in simulations) {
    if (!isInFeedWindow(sim.time, clock)) continue;
    if (quakes.any((quake) => quake.id == sim.id)) continue;
    final earthquake = earthquakeFromSimulation(sim);
    if (earthquake != null) extras.add(earthquake);
  }
  if (extras.isEmpty) return quakes;
  return [...extras, ...quakes];
}

int simulationIndex(SimulatedQuake sim, List<SimulatedQuake> simulations, int usgsNewer) {
  final ahead = simulations.where((other) {
    if (other.id == sim.id) return false;
    if (other.time != sim.time) return other.time > sim.time;
    return other.id.compareTo(sim.id) < 0;
  }).length;
  return usgsNewer + ahead;
}

UsgsSlice usgsSliceForPage(int page, int pageSize, Iterable<int> indexes) {
  final start = (page - 1) * pageSize;
  final end = start + pageSize;
  final indexList = indexes.toList();
  final before = indexList.where((index) => index < start).length;
  final onPage = indexList.where((index) => index >= start && index < end).length;
  final offset = start - before + 1;
  return UsgsSlice(
    offset: offset < 1 ? 1 : offset,
    limit: pageSize - onPage < 0 ? 0 : pageSize - onPage,
  );
}

List<Earthquake> assembleHistoryPage({
  required List<Earthquake> usgs,
  required List<Earthquake> simulated,
  required Map<String, int> indexes,
  required int page,
  required int pageSize,
}) {
  final start = (page - 1) * pageSize;
  final end = start + pageSize;
  final onPage = simulated.where((item) {
    final index = indexes[item.id];
    return index != null && index >= start && index < end;
  }).toList()
    ..sort((a, b) => indexes[a.id]!.compareTo(indexes[b.id]!));

  final items = <Earthquake>[];
  var usgsCursor = 0;
  var simCursor = 0;
  for (var index = start; index < end; index++) {
    if (simCursor < onPage.length && indexes[onPage[simCursor].id] == index) {
      items.add(onPage[simCursor]);
      simCursor++;
      continue;
    }
    if (usgsCursor >= usgs.length) break;
    items.add(usgs[usgsCursor]);
    usgsCursor++;
  }
  return items;
}

double? _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value);
  return null;
}
