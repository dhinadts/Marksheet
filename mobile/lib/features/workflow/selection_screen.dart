import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/catalog_item.dart';
import '../../providers/providers.dart';

class SelectionScreen extends ConsumerStatefulWidget {
  const SelectionScreen({super.key});
  @override
  ConsumerState<SelectionScreen> createState() => _SelectionScreenState();
}

class _SelectionScreenState extends ConsumerState<SelectionScreen> {
  static const steps = [
    ('universities', 'University'),
    ('colleges', 'College'),
    ('departments', 'Department'),
    ('academic-years', 'Academic year'),
    ('classes', 'Class'),
    ('subjects', 'Subject'),
  ];
  final selected = <String, CatalogItem>{};
  int index = 0;
  late Future<List<CatalogItem>> items;
  @override
  void initState() {
    super.initState();
    items = _load();
  }

  Future<List<CatalogItem>> _load() async {
    if (index == steps.length) {
      return ref
          .read(academicRepositoryProvider)
          .publishedPapers(selected['Subject']!.id);
    }
    final rows = await ref
        .read(academicRepositoryProvider)
        .catalog(steps[index].$1);
    final parentFields = <int, (String, String)>{
      1: ('universityId', 'University'),
      2: ('collegeId', 'College'),
      4: ('academicYearId', 'Academic year'),
      5: ('departmentId', 'Department'),
    };
    final parent = parentFields[index];
    return parent == null
        ? rows
        : rows
              .where((item) => item.raw[parent.$1] == selected[parent.$2]?.id)
              .toList();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Capture context')),
    body: FutureBuilder<List<CatalogItem>>(
      future: items,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _Message(
            icon: Icons.cloud_off,
            text: 'Could not load data.\n${snapshot.error}',
            action: () => setState(() => items = _load()),
          );
        }
        final label = index == steps.length
            ? 'Question paper'
            : steps[index].$2;
        final rows = snapshot.data!;
        if (rows.isEmpty) {
          return _Message(
            icon: Icons.inbox_outlined,
            text: 'No active $label records are available.',
            action: () => setState(() => items = _load()),
          );
        }
        return Column(
          children: [
            LinearProgressIndicator(value: (index + 1) / (steps.length + 1)),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Select $label',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
            Expanded(
              child: ListView.separated(
                itemCount: rows.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (_, i) => ListTile(
                  title: Text(rows[i].label),
                  subtitle: Text(rows[i].raw['code']?.toString() ?? ''),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    selected[label] = rows[i];
                    if (index == steps.length) {
                      final contextIds = selected.map(
                        (key, value) => MapEntry(key, value.id),
                      );
                      contextIds['markingSchemeVersionId'] =
                          rows[i].raw['markingSchemeVersionId'] as String;
                      context.push('/capture', extra: contextIds);
                    } else {
                      setState(() {
                        index++;
                        items = _load();
                      });
                    }
                  },
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.text,
    required this.action,
  });
  final IconData icon;
  final String text;
  final VoidCallback action;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center),
          TextButton(onPressed: action, child: const Text('Retry')),
        ],
      ),
    ),
  );
}
