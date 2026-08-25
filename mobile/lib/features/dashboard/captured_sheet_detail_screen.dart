import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/providers.dart';
import '../../repositories/mark_sheet_repository.dart';

class CapturedSheetDetailScreen extends ConsumerWidget {
  const CapturedSheetDetailScreen({required this.markSheetId, super.key});
  final String markSheetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Captured mark sheet')),
    body: FutureBuilder<MarkSheetDetail>(
      future: ref.read(markSheetRepositoryProvider).detail(markSheetId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load extracted marks.\n${snapshot.error}',
                textAlign: TextAlign.center,
              ),
            ),
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
            Text(
              sheet.student.isEmpty ? 'Captured mark sheet' : sheet.student,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(sheet.subject),
            const SizedBox(height: 12),
            if (sheet.marks.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    sheet.status == 'UPLOADED' || sheet.status == 'PROCESSING'
                        ? 'Handwriting extraction is processing. Pull back and reopen to refresh.'
                        : 'No extracted marks are available. Manual review is required.',
                  ),
                ),
              )
            else ...[
              ...sheet.marks.map(
                (mark) => Card(
                  child: ListTile(
                    title: Text(mark.label),
                    subtitle: Text(mark.status.replaceAll('_', ' ')),
                    trailing: Text(
                      mark.value == null
                          ? '— / ${_format(mark.maximum)}'
                          : '${_format(mark.value!)} / ${_format(mark.maximum)}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ),
              ),
              Card(
                color: Theme.of(context).colorScheme.primaryContainer,
                child: ListTile(
                  title: const Text('Total'),
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
}
