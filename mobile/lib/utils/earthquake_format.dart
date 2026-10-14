import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/earthquake.dart';

class DangerLevel {
  const DangerLevel(this.label, this.color);

  final String label;
  final Color color;
}

const dangerLegend = <DangerLevel>[
  DangerLevel('Menor < 3', Color(0xFF22C55E)),
  DangerLevel('Leve 3–4', Color(0xFFEAB308)),
  DangerLevel('Moderado 4–5', Color(0xFFF59E0B)),
  DangerLevel('Fuerte 5–6', Color(0xFFEA580C)),
  DangerLevel('Muy fuerte 6–7', Color(0xFFDC2626)),
  DangerLevel('Extremo ≥ 7', Color(0xFFC026D3)),
];

DangerLevel dangerLevelFor(double magnitude) {
  if (magnitude >= 7) return const DangerLevel('Extremo', Color(0xFFC026D3));
  if (magnitude >= 6) return const DangerLevel('Muy fuerte', Color(0xFFDC2626));
  if (magnitude >= 5) return const DangerLevel('Fuerte', Color(0xFFEA580C));
  if (magnitude >= 4) return const DangerLevel('Moderado', Color(0xFFF59E0B));
  if (magnitude >= 3) return const DangerLevel('Leve', Color(0xFFEAB308));
  return const DangerLevel('Menor', Color(0xFF22C55E));
}

double markerSizeFor(double magnitude) {
  return (7 + magnitude * 2.2).clamp(8, 22).toDouble();
}

String formatMagnitude(double magnitude) => 'M ${magnitude.toStringAsFixed(1)}';

String formatClock(DateTime date) {
  final local = date.toLocal();
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(local.hour)}:${two(local.minute)}:${two(local.second)}';
}

String formatDateTime(int timestamp) {
  final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
  return DateFormat("d 'de' MMMM 'de' y, HH:mm:ss", 'es').format(date);
}

String formatShortDateTime(int timestamp) {
  final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
  return DateFormat('dd/MM/yy HH:mm', 'es').format(date);
}

String formatRelativeTime(int timestamp, {DateTime? now}) {
  final clock = now ?? DateTime.now();
  final minutes = clock.difference(DateTime.fromMillisecondsSinceEpoch(timestamp)).inMinutes;
  if (minutes < 1) return 'hace unos segundos';
  if (minutes < 60) return 'hace $minutes min';
  final hours = minutes ~/ 60;
  if (hours < 24) return 'hace $hours h';
  final days = hours ~/ 24;
  return 'hace $days d';
}

String formatCoordinates(double latitude, double longitude) {
  final latDir = latitude >= 0 ? 'N' : 'S';
  final lonDir = longitude >= 0 ? 'E' : 'O';
  return '${latitude.abs().toStringAsFixed(3)}° $latDir, ${longitude.abs().toStringAsFixed(3)}° $lonDir';
}

String formatThousands(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  if (value < 0) buffer.write('-');
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write('.');
    buffer.write(digits[index]);
  }
  return buffer.toString();
}

bool isRecent(Earthquake earthquake, {DateTime? now, int minutes = 30}) {
  final clock = now ?? DateTime.now();
  return clock.millisecondsSinceEpoch - earthquake.time < minutes * 60000;
}

String historyRangeLabel({
  required int? total,
  required int page,
  required int pageSize,
  required int loadedCount,
}) {
  if (total == null) {
    if (loadedCount == 0) return 'Cargando…';
    final from = (page - 1) * pageSize + 1;
    final to = from + loadedCount - 1;
    return '$from–$to';
  }
  if (total == 0) return '0 resultados';
  final from = (page - 1) * pageSize + 1;
  final to = page * pageSize < total ? page * pageSize : total;
  return '$from–$to de ${formatThousands(total)}';
}
