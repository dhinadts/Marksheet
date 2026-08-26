import 'dart:async';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
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

  Future<void> _uploadPending({
    bool silent = false,
    QueuedCapture? target,
  }) async {
    if (uploading || !mounted) return;
    // Claim the upload loop before any asynchronous work. App resume, the
    // connectivity listener and the first-frame callback can otherwise all
    // start a retry for the same capture at once.
    setState(() => uploading = true);
    var pending = <QueuedCapture>[];
    var completed = 0;
    Object? lastError;
    try {
      final current = await queue.read();
      pending = target == null
          ? current
          : current.where((entry) => entry.id == target.id).toList();
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
        } catch (error) {
          // Keep failed entries safely queued for the next retry.
          lastError = error;
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
                    ? 'Mark extraction failed; the capture remains safely queued. ${_uploadErrorMessage(lastError)}'
                    : '$completed capture${completed == 1 ? '' : 's'} moved to Captured mark sheets',
              ),
            ),
          );
        }
      }
    }
  }

  String _uploadErrorMessage(Object? error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      if (error.type == DioExceptionType.receiveTimeout) {
        return 'The AI service took too long to respond. Tap to retry.';
      }
    }
    return 'Tap to retry.';
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
                    title: const Text('Online extraction queue'),
                    subtitle: Text(
                      pending.isEmpty
                          ? 'All captures have been sent for extraction'
                          : '${pending.length} capture${pending.length == 1 ? '' : 's'} ready to upload and extract • Tap to start',
                    ),
                    onTap: pending.isEmpty || uploading
                        ? null
                        : () => _uploadPending(),
                  ),
                ),
                if (pending.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  ...pending.map(
                    (entry) => Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.description_outlined),
                        ),
                        title: Text(
                          entry.context['_studentLabel'] ??
                              entry.context['Student label'] ??
                              'Queued mark sheet',
                        ),
                        subtitle: Text(
                          '${entry.context['_subjectLabel'] ?? entry.context['Subject label'] ?? 'Subject'}\n'
                          'Queued ${entry.createdAt.toLocal()} • Tap to convert',
                        ),
                        isThreeLine: true,
                        trailing: const Icon(Icons.play_arrow),
                        onTap: uploading
                            ? null
                            : () => _uploadPending(target: entry),
                      ),
                    ),
                  ),
                ],
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
