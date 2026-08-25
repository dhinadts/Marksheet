import 'dart:async';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/providers.dart';
import '../capture/offline_capture_queue.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with WidgetsBindingObserver {
  final queue = OfflineCaptureQueue();
  final connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? connectivitySubscription;
  late Future<(List<QueuedCapture>, List<CapturedMarkSheet>)> captures;
  bool uploading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    captures = _load();
    connectivitySubscription = connectivity.onConnectivityChanged.listen((
      results,
    ) {
      if (!results.contains(ConnectivityResult.none)) {
        _uploadPending(silent: true);
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _uploadPending(silent: true);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _uploadPending(silent: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    connectivitySubscription?.cancel();
    super.dispose();
  }

  Future<(List<QueuedCapture>, List<CapturedMarkSheet>)> _load() async =>
      (await queue.read(), await queue.readHistory());

  void _refresh() => setState(() {
    captures = _load();
  });

  Future<void> _uploadPending({bool silent = false}) async {
    if (uploading || !mounted) return;
    // Claim the upload loop before any asynchronous work. App resume, the
    // connectivity listener and the first-frame callback can otherwise all
    // start a retry for the same capture at once.
    setState(() => uploading = true);
    var pending = <QueuedCapture>[];
    var completed = 0;
    try {
      pending = await queue.read();
      if (pending.isEmpty || !await queue.isOnline) return;
      for (final entry in pending) {
        try {
          final result = await ref
              .read(uploadRepositoryProvider)
              .upload(
                imagePath: entry.imagePath,
                context: entry.context,
                clientRequestId: entry.id,
              );
          await queue.recordUploaded(
            entry,
            markSheetId: result.markSheetId,
            status: result.status,
          );
          await queue.remove(entry.id);
          final image = File(entry.imagePath);
          if (await image.exists()) await image.delete();
          completed++;
        } catch (_) {
          // Keep failed entries safely queued for the next retry.
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          uploading = false;
          captures = _load();
        });
        if (pending.isNotEmpty && (!silent || completed > 0)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                completed == 0
                    ? 'Queued captures are still waiting for the server'
                    : '$completed capture${completed == 1 ? '' : 's'} moved to Captured mark sheets',
              ),
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('AI-MARKS'),
      actions: [
        IconButton(
          tooltip: 'Refresh captures',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: 'Sign out',
          onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Valuation capture',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Select the academic context and published question paper before capturing a mark sheet.',
        ),
        const SizedBox(height: 24),
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.camera_alt_outlined)),
            title: const Text('New mark-sheet capture'),
            subtitle: const Text(
              'Guided camera and on-device quality preflight',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              await context.push('/select');
              if (mounted) _refresh();
            },
          ),
        ),
        const SizedBox(height: 12),
        FutureBuilder<(List<QueuedCapture>, List<CapturedMarkSheet>)>(
          future: captures,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final pending = snapshot.data!.$1;
            final uploaded = snapshot.data!.$2;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: uploading
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.sync),
                    ),
                    title: const Text('Offline queue'),
                    subtitle: Text(
                      '${pending.length} capture${pending.length == 1 ? '' : 's'} waiting to upload${pending.isEmpty ? '' : ' • Tap to retry'}',
                    ),
                    onTap: pending.isEmpty || uploading
                        ? null
                        : () => _uploadPending(),
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: const CircleAvatar(
                      child: Icon(Icons.description_outlined),
                    ),
                    title: const Text('Captured mark sheets'),
                    subtitle: Text(
                      '${uploaded.length} uploaded sheet${uploaded.length == 1 ? '' : 's'}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      await context.push('/captures');
                      if (mounted) _refresh();
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ],
    ),
  );
}

class CapturedSheetCard extends StatelessWidget {
  const CapturedSheetCard({super.key, required this.item});
  final CapturedMarkSheet item;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: const CircleAvatar(child: Icon(Icons.description_outlined)),
      title: Text(item.context['_studentLabel'] ?? 'Captured mark sheet'),
      subtitle: Text(
        '${item.context['_subjectLabel'] ?? 'Subject'}\n'
        '${item.status} • ${item.createdAt.toLocal()}\n'
        'ID: ${item.markSheetId}',
      ),
      isThreeLine: true,
    ),
  );
}
