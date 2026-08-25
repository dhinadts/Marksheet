import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../capture/offline_capture_queue.dart';

class CapturedSheetsScreen extends StatefulWidget {
  const CapturedSheetsScreen({super.key});
  @override
  State<CapturedSheetsScreen> createState() => _CapturedSheetsScreenState();
}

class _CapturedSheetsScreenState extends State<CapturedSheetsScreen> {
  static const pageSize = 50;
  final queue = OfflineCaptureQueue();
  final scrollController = ScrollController();
  List<CapturedMarkSheet> all = const [];
  int visibleCount = pageSize;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    scrollController.addListener(_loadMore);
    _refresh();
  }

  Future<void> _refresh() async {
    final items = await queue.readHistory();
    if (!mounted) return;
    setState(() {
      all = items;
      visibleCount = pageSize;
      loading = false;
    });
  }

  void _loadMore() {
    if (scrollController.position.extentAfter > 500 ||
        visibleCount >= all.length) {
      return;
    }
    setState(
      () => visibleCount = (visibleCount + pageSize).clamp(0, all.length),
    );
  }

  @override
  void dispose() {
    scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Captured mark sheets'),
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: loading
        ? const Center(child: CircularProgressIndicator())
        : all.isEmpty
        ? const Center(child: Text('No captured mark sheets yet'))
        : RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: visibleCount.clamp(0, all.length),
              itemBuilder: (_, index) => _SheetTile(item: all[index]),
            ),
          ),
  );
}

class _SheetTile extends StatelessWidget {
  const _SheetTile({required this.item});
  final CapturedMarkSheet item;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: const CircleAvatar(child: Icon(Icons.description_outlined)),
      title: Text(item.context['_studentLabel'] ?? 'Captured mark sheet'),
      subtitle: Text(
        '${item.context['_subjectLabel'] ?? 'Subject'}\n${item.status} • ${item.createdAt.toLocal()}\nID: ${item.markSheetId}',
      ),
      isThreeLine: true,
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push('/captures/${item.markSheetId}'),
    ),
  );
}
