class Earthquake {
  const Earthquake({
    required this.id,
    required this.magnitude,
    required this.place,
    required this.title,
    required this.time,
    required this.updated,
    required this.url,
    required this.felt,
    required this.cdi,
    required this.mmi,
    required this.alert,
    required this.status,
    required this.tsunami,
    required this.significance,
    required this.magType,
    required this.type,
    required this.longitude,
    required this.latitude,
    required this.depth,
  });

  final String id;
  final double magnitude;
  final String place;
  final String title;
  final int time;
  final int updated;
  final String url;
  final int? felt;
  final double? cdi;
  final double? mmi;
  final String? alert;
  final String status;
  final int tsunami;
  final int significance;
  final String magType;
  final String type;
  final double longitude;
  final double latitude;
  final double depth;
}

Earthquake? earthquakeFromFeature(Map<String, dynamic> feature) {
  final properties = _asMap(feature['properties']);
  final geometry = _asMap(feature['geometry']);
  final magnitude = _asDouble(properties?['mag']);
  final coordinates = geometry?['coordinates'];

  if (properties == null ||
      geometry == null ||
      magnitude == null ||
      coordinates is! List ||
      coordinates.length < 2) {
    return null;
  }

  final longitude = _asDouble(coordinates[0]);
  final latitude = _asDouble(coordinates[1]);
  if (longitude == null || latitude == null) return null;

  final depth = coordinates.length > 2 ? (_asDouble(coordinates[2]) ?? 0) : 0.0;
  final id = feature['id'];

  return Earthquake(
    id: id is String && id.isNotEmpty ? id : '$longitude,$latitude,$magnitude',
    magnitude: magnitude,
    place: _asString(properties['place']) ?? 'Ubicación no disponible',
    title: _asString(properties['title']) ?? '',
    time: _asInt(properties['time']) ?? 0,
    updated: _asInt(properties['updated']) ?? 0,
    url: _asString(properties['url']) ?? '',
    felt: _asInt(properties['felt']),
    cdi: _asDouble(properties['cdi']),
    mmi: _asDouble(properties['mmi']),
    alert: _asString(properties['alert']),
    status: _asString(properties['status']) ?? '—',
    tsunami: _asInt(properties['tsunami']) ?? 0,
    significance: _asInt(properties['sig']) ?? 0,
    magType: _asString(properties['magType']) ?? '—',
    type: _asString(properties['type']) ?? 'earthquake',
    longitude: longitude,
    latitude: latitude,
    depth: depth,
  );
}

Map<String, dynamic>? _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

String? _asString(Object? value) {
  if (value is String && value.isNotEmpty) return value;
  return null;
}

int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return null;
}

double? _asDouble(Object? value) {
  if (value is num && value.isFinite) return value.toDouble();
  return null;
}
