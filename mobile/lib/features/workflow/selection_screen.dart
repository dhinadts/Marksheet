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
    ('sections', 'Section'),
    ('students', 'Student'),
    ('subjects', 'Subject'),
    ('subject-offerings', 'Subject offering'),
  ];
  final selected = <String, CatalogItem>{};
  final completedStudentIds = <String>{};
  bool batchActive = false;
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
      5: ('classId', 'Class'),
      6: ('sectionId', 'Section'),
      7: ('departmentId', 'Department'),
    };
    if (index == 8) {
      return rows
          .where(
            (item) =>
                item.raw['sectionId'] == selected['Section']?.id &&
                item.raw['subjectId'] == selected['Subject']?.id &&
                item.raw['academicYearId'] == selected['Academic year']?.id,
          )
          .toList();
    }
    final parent = parentFields[index];
    final filtered = parent == null
        ? rows
        : rows
              .where((item) => item.raw[parent.$1] == selected[parent.$2]?.id)
              .toList();
    if (index == 6 && batchActive) {
      return filtered
          .where((item) => !completedStudentIds.contains(item.id))
          .toList();
    }
    return filtered;
  }

  Future<void> _openCapture() async {
    final paper = selected['Question paper']!;
    final contextIds = selected.map((key, value) => MapEntry(key, value.id));
    contextIds['_studentLabel'] = selected['Student']?.label ?? 'Student';
    contextIds['_subjectLabel'] = selected['Subject']?.label ?? 'Subject';
    contextIds['_paperLabel'] = paper.label;
    contextIds['markingSchemeVersionId'] =
        paper.raw['markingSchemeVersionId'] as String;
    final studentId = selected['Student']!.id;
    final result = await context.push<String>('/capture', extra: contextIds);
    if (!mounted || result != 'captured') return;
    setState(() {
      completedStudentIds.add(studentId);
      batchActive = true;
      index = 6;
      selected.remove('Student');
      items = _load();
    });
  }

  void _completeSubject() => context.go('/');

  void _previousStep() {
    if (index == 0) {
      context.pop();
      return;
    }
    setState(() {
      index--;
      for (var step = index; step < steps.length; step++) {
        selected.remove(steps[step].$2);
      }
      selected.remove('Question paper');
      items = _load();
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: index == 0,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _previousStep();
    },
    child: Scaffold(
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
              action: () => setState(() {
                items = _load();
              }),
            );
          }
          final label = index == steps.length
              ? 'Question paper'
              : steps[index].$2;
          final rows = snapshot.data!;
          if (rows.isEmpty) {
            if (batchActive && index == 6) {
              return _BatchComplete(
                subject: selected['Subject']?.label ?? 'subject',
                count: completedStudentIds.length,
                onComplete: _completeSubject,
              );
            }
            return _Message(
              icon: Icons.inbox_outlined,
              text: 'No active $label records are available.',
              action: () => setState(() {
                items = _load();
              }),
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
              if (batchActive && index == 6)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _completeSubject,
                      icon: const Icon(Icons.check_circle_outline),
                      label: Text(
                        'Completed ${selected['Subject']?.label ?? 'subject'}',
                      ),
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
                    onTap: () async {
                      selected[label] = rows[i];
                      if (batchActive && index == 6) {
                        await _openCapture();
                        return;
                      }
                      if (index == steps.length) {
                        await _openCapture();
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
    ),
  );
}

class _BatchComplete extends StatelessWidget {
  const _BatchComplete({
    required this.subject,
    required this.count,
    required this.onComplete,
  });
  final String subject;
  final int count;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.task_alt, size: 56, color: Colors.green),
          const SizedBox(height: 12),
          Text('$count student mark sheets captured'),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: onComplete,
            icon: const Icon(Icons.check),
            label: Text('Completed $subject'),
          ),
        ],
      ),
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
