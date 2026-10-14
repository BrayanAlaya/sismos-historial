import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/earthquake.dart';
import '../theme/app_theme.dart';
import '../utils/earthquake_format.dart';

Future<void> showEarthquakeDetail(
  BuildContext context,
  Earthquake earthquake,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: const Color(0xFF0F172A),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => EarthquakeDetailSheet(earthquake: earthquake),
  );
}

class EarthquakeDetailSheet extends StatelessWidget {
  const EarthquakeDetailSheet({super.key, required this.earthquake});

  final Earthquake earthquake;

  @override
  Widget build(BuildContext context) {
    final danger = dangerLevelFor(earthquake.magnitude);
    final felt = earthquake.felt == null
        ? 'Sin reportes'
        : '${formatThousands(earthquake.felt!)} reportes';

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Text(
                    'DETALLE DEL SISMO',
                    style: TextStyle(
                      color: kKicker,
                      fontSize: 12,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                  tooltip: 'Cerrar',
                ),
              ],
            ),
            Text(
              earthquake.place,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  formatMagnitude(earthquake.magnitude),
                  style: TextStyle(
                    color: danger.color,
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 8),
                Text(earthquake.magType, style: const TextStyle(color: kMuted)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: danger.color.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    danger.label,
                    style: TextStyle(
                      color: danger.color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            if (earthquake.tsunami == 1) ...[
              const SizedBox(height: 14),
              const Text(
                'Alerta de tsunami asociada a este evento',
                style: TextStyle(color: Color(0xFFFBBF24), fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 16),
            _DetailRow(label: 'Hace', value: formatRelativeTime(earthquake.time)),
            _DetailRow(label: 'Fecha y hora', value: formatDateTime(earthquake.time)),
            _DetailRow(
              label: 'Profundidad',
              value: '${earthquake.depth.toStringAsFixed(1)} km',
            ),
            _DetailRow(
              label: 'Coordenadas',
              value: formatCoordinates(earthquake.latitude, earthquake.longitude),
            ),
            _DetailRow(label: 'Tipo', value: earthquake.type),
            _DetailRow(label: 'Estado', value: earthquake.status),
            _DetailRow(label: 'Personas que lo sintieron', value: felt),
            _DetailRow(
              label: 'Intensidad MMI',
              value: earthquake.mmi?.toStringAsFixed(1) ?? 'No disponible',
            ),
            _DetailRow(
              label: 'Intensidad comunitaria',
              value: earthquake.cdi?.toStringAsFixed(1) ?? 'No disponible',
            ),
            _DetailRow(label: 'Alerta USGS', value: earthquake.alert ?? 'Sin alerta'),
            _DetailRow(label: 'Significancia', value: '${earthquake.significance}'),
            _DetailRow(label: 'ID USGS', value: earthquake.id),
            if (earthquake.url.isNotEmpty) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => _openUsgs(context, earthquake.url),
                child: const Text('Ver ficha completa en USGS'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _openUsgs(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el enlace.')),
      );
    }
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 148,
            child: Text(label, style: const TextStyle(color: kMuted)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
