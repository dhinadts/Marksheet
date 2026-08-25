import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/providers.dart';
import '../../repositories/mark_sheet_repository.dart';

class CapturedSheetDetailScreen extends ConsumerStatefulWidget {
  const CapturedSheetDetailScreen({required this.markSheetId, super.key});
  final String markSheetId;

  @override
  ConsumerState<CapturedSheetDetailScreen> createState() => _DetailState();
}

class _DetailState extends ConsumerState<CapturedSheetDetailScreen> {
  Timer? timer;
  late Future<MarkSheetDetail> detail;

  @override
  void initState() {
    super.initState();
    detail = _load();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  Future<MarkSheetDetail> _load() =>
      ref.read(markSheetRepositoryProvider).detail(widget.markSheetId);
  void _refresh() {
    if (mounted) {
      setState(() {
        detail = _load();
      });
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Captured mark sheet'),
      actions: [
        IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
      ],
    ),
    body: FutureBuilder<MarkSheetDetail>(
      future: detail,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: Text('Could not load marks.\n${snapshot.error}'),
          );
        }
        final sheet = snapshot.requireData;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (sheet.imageUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  sheet.imageUrl!,
                  height: 240,
                  fit: BoxFit.contain,
                ),
              ),
            const SizedBox(height: 16),
            Text(sheet.student, style: Theme.of(context).textTheme.titleLarge),
            Text(sheet.subject),
            if (sheet.hierarchy.isNotEmpty)
              Text(
                sheet.hierarchy,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            const SizedBox(height: 16),
            if (sheet.marks.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    sheet.status == 'UPLOADED' || sheet.status == 'PROCESSING'
                        ? 'Numeric mark extraction is processing. This page refreshes automatically.'
                        : 'No extracted marks are available. Manual review is required.',
                  ),
                ),
              )
            else ...[
              Text(
                'Question-wise marks',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Card(
                clipBehavior: Clip.antiAlias,
                child: Table(
                  columnWidths: const {
                    0: FlexColumnWidth(2.2),
                    1: FlexColumnWidth(1.2),
                    2: FlexColumnWidth(1.2),
                  },
                  defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                  children: [
                    _header(context),
                    ...sheet.marks.map((mark) => _row(context, mark)),
                  ],
                ),
              ),
              Card(
                color: Theme.of(context).colorScheme.primaryContainer,
                child: ListTile(
                  title: const Text('Total obtained'),
                  subtitle: Text(
                    sheet.isComplete
                        ? 'Computer-calculated total'
                        : 'Incomplete — review required',
                  ),
                  trailing: Text(
                    '${_format(sheet.total)} / ${_format(sheet.maximum)}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ),
            ],
          ],
        );
      },
    ),
  );

  static String _format(double value) => value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(2);

  static TableRow _header(BuildContext context) => TableRow(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
    ),
    children: const [
      _Cell('Question', bold: true),
      _Cell('Obtained', bold: true, centered: true),
      _Cell('Maximum', bold: true, centered: true),
    ],
  );

  static TableRow _row(BuildContext context, DisplayMark mark) => TableRow(
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
    ),
    children: [
      _Cell(mark.label),
      _Cell(
        mark.value == null ? '—' : _format(mark.value!),
        bold: true,
        centered: true,
      ),
      _Cell(_format(mark.maximum), centered: true),
    ],
  );
}

class _Cell extends StatelessWidget {
  const _Cell(this.text, {this.bold = false, this.centered = false});
  final String text;
  final bool bold;
  final bool centered;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
    child: Text(
      text,
      textAlign: centered ? TextAlign.center : TextAlign.start,
      style: TextStyle(fontWeight: bold ? FontWeight.w700 : null),
    ),
  );
}
