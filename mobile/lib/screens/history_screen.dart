import 'package:flutter/material.dart';

import '../models/earthquake.dart';
import '../services/usgs_api.dart';
import '../theme/app_theme.dart';
import '../utils/earthquake_format.dart';
import '../widgets/earthquake_detail_sheet.dart';

const _pageSizes = [10, 20, 50, 100];

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Earthquake> _earthquakes = const [];
  int? _total;
  var _page = 1;
  var _pageSize = 10;
  var _loading = true;
  String? _error;
  var _requestId = 0;

  @override
  void initState() {
    super.initState();
    _loadCount();
    _loadPage();
  }

  @override
  void dispose() {
    _requestId++;
    super.dispose();
  }

  Future<void> _loadCount() async {
    try {
      final count = await fetchEarthquakeHistoryCount();
      if (!mounted) return;
      final pages = _totalPages(count, _pageSize);
      setState(() => _total = count);
      if (_page > pages) {
        setState(() => _page = pages);
        await _loadPage();
      }
    } catch (_) {
      // The list still works without the total.
    }
  }

  Future<void> _loadPage() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final data = await fetchEarthquakeHistory(page: _page, pageSize: _pageSize);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _earthquakes = data;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _loading = false;
        _error = error is UsgsException
            ? error.message
            : 'No se pudo cargar el historial.';
      });
    }
  }

  int _totalPages(int? total, int pageSize) {
    if (total == null) return 1;
    final pages = (total / pageSize).ceil();
    return pages < 1 ? 1 : pages;
  }

  bool get _canGoNext {
    final total = _total;
    if (total == null) return _earthquakes.length == _pageSize;
    return _page < _totalPages(total, _pageSize);
  }

  @override
  Widget build(BuildContext context) {
    final pages = _totalPages(_total, _pageSize);
    final range = historyRangeLabel(
      total: _total,
      page: _page,
      pageSize: _pageSize,
      loadedCount: _earthquakes.length,
    );

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'CATÁLOGO USGS · 30 DÍAS',
              style: TextStyle(
                color: kKicker,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text('Historial', style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Expanded(child: Text(range, style: const TextStyle(color: kMuted))),
                const Text('Por página', style: TextStyle(color: kMuted, fontSize: 12)),
                const SizedBox(width: 8),
                DropdownButton<int>(
                  value: _pageSize,
                  items: [
                    for (final size in _pageSizes)
                      DropdownMenuItem(value: size, child: Text('$size')),
                  ],
                  onChanged: _loading
                      ? null
                      : (value) {
                          if (value == null || value == _pageSize) return;
                          setState(() {
                            _pageSize = value;
                            _page = 1;
                          });
                          _loadPage();
                        },
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: _error != null
                ? Center(child: Text(_error!))
                : _earthquakes.isEmpty && !_loading
                ? const Center(child: Text('No hay sismos en esta página.'))
                : ListView.separated(
                    itemCount: _earthquakes.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final earthquake = _earthquakes[index];
                      final danger = dangerLevelFor(earthquake.magnitude);
                      return ListTile(
                        onTap: () => showEarthquakeDetail(context, earthquake),
                        title: Text(
                          earthquake.place,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          '${formatShortDateTime(earthquake.time)} · ${earthquake.depth.toStringAsFixed(1)} km · ${formatRelativeTime(earthquake.time)}',
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              formatMagnitude(earthquake.magnitude),
                              style: TextStyle(
                                color: danger.color,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              danger.label,
                              style: TextStyle(color: danger.color, fontSize: 12),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _page <= 1 || _loading
                          ? null
                          : () {
                              setState(() => _page -= 1);
                              _loadPage();
                            },
                      child: const Text('Anterior'),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      _total == null ? 'Página $_page' : 'Página $_page de $pages',
                    ),
                  ),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: !_canGoNext || _loading
                          ? null
                          : () {
                              setState(() => _page += 1);
                              _loadPage();
                            },
                      child: const Text('Siguiente'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
