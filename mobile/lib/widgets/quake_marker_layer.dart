import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../models/earthquake.dart';
import '../utils/earthquake_format.dart';

const _labelStyle = TextStyle(
  color: Color(0xFF0F172A),
  fontSize: 11,
  fontWeight: FontWeight.w800,
);

const _haloStyle = TextStyle(
  color: Colors.white,
  fontSize: 11,
  fontWeight: FontWeight.w800,
);

final _labelPainters = <String, TextPainter>{};
final _haloPainters = <String, TextPainter>{};

class QuakeMarkerLayer extends StatelessWidget {
  const QuakeMarkerLayer({
    super.key,
    required this.earthquakes,
    this.userPoint,
  });

  final List<Earthquake> earthquakes;
  final LatLng? userPoint;

  @override
  Widget build(BuildContext context) {
    final camera = MapCamera.of(context);
    return IgnorePointer(
      child: CustomPaint(
        size: camera.size,
        isComplex: true,
        painter: _QuakeMarkerPainter(
          earthquakes: earthquakes,
          camera: camera,
          userPoint: userPoint,
        ),
      ),
    );
  }
}

Earthquake? quakeAtScreenPoint({
  required MapCamera camera,
  required List<Earthquake> earthquakes,
  required double minMagnitude,
  required Offset point,
}) {
  Earthquake? best;
  var bestDistance = double.infinity;

  for (final earthquake in earthquakes) {
    if (earthquake.magnitude < minMagnitude) continue;
    final radius = markerSizeFor(earthquake.magnitude) / 2;
    final hitRadius = radius + 14;
    for (final center in _screenCenters(
      camera,
      LatLng(earthquake.latitude, earthquake.longitude),
    )) {
      final distance = (center - point).distance;
      if (distance <= hitRadius && distance < bestDistance) {
        bestDistance = distance;
        best = earthquake;
      }
    }
  }

  return best;
}

class _QuakeMarkerPainter extends CustomPainter {
  _QuakeMarkerPainter({
    required this.earthquakes,
    required this.camera,
    required this.userPoint,
  });

  final List<Earthquake> earthquakes;
  final MapCamera camera;
  final LatLng? userPoint;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.clipRect(Offset.zero & size);

    final fill = Paint();
    final border = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke;

    for (final earthquake in earthquakes) {
      final radius = markerSizeFor(earthquake.magnitude) / 2;
      fill.color = dangerLevelFor(earthquake.magnitude).color;
      border.strokeWidth = isRecent(earthquake) ? 2.4 : 1.5;

      for (final center in _screenCenters(
        camera,
        LatLng(earthquake.latitude, earthquake.longitude),
      )) {
        if (!_onScreen(center, radius, size)) continue;
        canvas.drawCircle(center, radius, fill);
        canvas.drawCircle(center, radius, border);
      }
    }

    for (final earthquake in earthquakes) {
      final radius = markerSizeFor(earthquake.magnitude) / 2;
      final label = formatMagnitude(earthquake.magnitude);
      final text = _textPainter(label, halo: false);
      final halo = _textPainter(label, halo: true);

      for (final center in _screenCenters(
        camera,
        LatLng(earthquake.latitude, earthquake.longitude),
      )) {
        final offset = Offset(
          center.dx - text.width / 2,
          center.dy - radius - text.height - 2,
        );
        if (!_onScreen(center, radius + text.height, size)) continue;
        halo.paint(canvas, offset + const Offset(1, 1));
        halo.paint(canvas, offset + const Offset(-1, 0));
        text.paint(canvas, offset);
      }
    }

    final userPoint = this.userPoint;
    if (userPoint == null) return;
    final userFill = Paint()..color = const Color(0xFF38BDF8);
    final userRing = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (final center in _screenCenters(camera, userPoint)) {
      if (!_onScreen(center, 16, size)) continue;
      canvas.drawCircle(center, 7, userFill);
      canvas.drawCircle(center, 7, userRing);
    }
  }

  @override
  bool shouldRepaint(covariant _QuakeMarkerPainter oldDelegate) {
    return earthquakes != oldDelegate.earthquakes ||
        camera != oldDelegate.camera ||
        userPoint != oldDelegate.userPoint;
  }
}

TextPainter _textPainter(String label, {required bool halo}) {
  final cache = halo ? _haloPainters : _labelPainters;
  return cache.putIfAbsent(label, () {
    final painter = TextPainter(
      text: TextSpan(text: label, style: halo ? _haloStyle : _labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    return painter;
  });
}

Iterable<Offset> _screenCenters(MapCamera camera, LatLng point) sync* {
  final origin = camera.getOffsetFromOrigin(point);
  final worldWidth = camera.getWorldWidthAtZoom();
  final width = camera.size.width;
  const margin = 64.0;

  yield origin;
  if (worldWidth <= 0) return;

  for (
    var shift = -worldWidth;
    origin.dx + shift > -margin;
    shift -= worldWidth
  ) {
    yield Offset(origin.dx + shift, origin.dy);
    if (shift < -worldWidth * 3) break;
  }
  for (
    var shift = worldWidth;
    origin.dx + shift < width + margin;
    shift += worldWidth
  ) {
    yield Offset(origin.dx + shift, origin.dy);
    if (shift > worldWidth * 3) break;
  }
}

bool _onScreen(Offset center, double padding, Size size) {
  return center.dx >= -padding &&
      center.dy >= -padding &&
      center.dx <= size.width + padding &&
      center.dy <= size.height + padding;
}
