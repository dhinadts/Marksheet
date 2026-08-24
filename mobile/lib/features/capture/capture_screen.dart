import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'image_quality.dart';
import 'offline_capture_queue.dart';
import '../../providers/providers.dart';

class CaptureScreen extends ConsumerStatefulWidget {
  const CaptureScreen({super.key, required this.selection});
  final Map<String, String> selection;
  @override
  ConsumerState<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends ConsumerState<CaptureScreen>
    with WidgetsBindingObserver {
  CameraController? controller;
  List<CameraDescription> cameras = const [];
  int cameraIndex = 0;
  XFile? captured;
  ImageQualityResult? quality;
  bool busy = true;
  bool flash = false;
  String? cameraError;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialize();
  }

  Future<void> _initialize() async {
    setState(() {
      busy = true;
      cameraError = null;
    });
    try {
      cameras = await availableCameras();
      if (cameras.isNotEmpty) {
        controller = CameraController(
          cameras[cameraIndex],
          ResolutionPreset.max,
          enableAudio: false,
        );
        await controller!.initialize();
      }
    } catch (error) {
      cameraError = error is CameraException
          ? (error.description ?? error.code)
          : error.toString();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive) controller?.dispose();
    if (state == AppLifecycleState.resumed) _initialize();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller?.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    if (controller?.value.isInitialized != true) return;
    setState(() => busy = true);
    final file = await controller!.takePicture();
    await _inspect(file);
  }

  Future<void> _pick() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 100,
    );
    if (file != null) await _inspect(file);
  }

  Future<void> _inspect(XFile file) async {
    final result = await const ImageQualityAnalyzer().analyze(file.path);
    if (mounted) {
      setState(() {
        captured = file;
        quality = result;
        busy = false;
      });
    }
  }

  Future<void> _toggleFlash() async {
    flash = !flash;
    await controller?.setFlashMode(flash ? FlashMode.torch : FlashMode.off);
    setState(() {});
  }

  Future<void> _switchCamera() async {
    if (cameras.length < 2) return;
    await controller?.dispose();
    cameraIndex = (cameraIndex + 1) % cameras.length;
    controller = CameraController(
      cameras[cameraIndex],
      ResolutionPreset.max,
      enableAudio: false,
    );
    await controller!.initialize();
    setState(() {});
  }

  Future<void> _queue() async {
    final queue = OfflineCaptureQueue();
    final entry = await queue.enqueue(captured!.path, widget.selection);
    var uploaded = false;
    if (await queue.isOnline) {
      try {
        await ref.read(uploadRepositoryProvider).upload(imagePath: entry.imagePath, context: entry.context, clientRequestId: entry.id);
        await queue.remove(entry.id);
        await File(entry.imagePath).delete();
        uploaded = true;
      } catch (_) {
        uploaded = false;
      }
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(uploaded ? 'Upload complete' : 'Capture added to device queue'),
        content: Text(
          uploaded ? 'The image was verified by the server and is ready for processing.' : 'The durable local copy remains safely queued on this device.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Capture mark sheet')),
    body: captured == null ? _camera() : _review(),
  );
  Widget _camera() => Column(
    children: [
      Expanded(
        child: ColoredBox(
          color: Colors.black,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (controller?.value.isInitialized == true)
                CameraPreview(controller!)
              else if (!busy && cameraError != null)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.no_photography,
                          color: Colors.white,
                          size: 48,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Camera unavailable: $cameraError',
                          style: const TextStyle(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _initialize,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else
                const Center(
                  child: Icon(
                    Icons.no_photography,
                    color: Colors.white,
                    size: 48,
                  ),
                ),
              const _PaperGuide(),
              if (busy) const Center(child: CircularProgressIndicator()),
            ],
          ),
        ),
      ),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                tooltip: 'Choose existing image',
                onPressed: busy ? null : _pick,
                icon: const Icon(Icons.photo_library_outlined),
              ),
              IconButton.filled(
                tooltip: 'Capture',
                iconSize: 34,
                onPressed: busy ? null : _capture,
                icon: const Icon(Icons.camera),
              ),
              IconButton(
                tooltip: 'Flash',
                onPressed: _toggleFlash,
                icon: Icon(flash ? Icons.flash_on : Icons.flash_off),
              ),
              IconButton(
                tooltip: 'Switch camera',
                onPressed: cameras.length > 1 ? _switchCamera : null,
                icon: const Icon(Icons.cameraswitch),
              ),
            ],
          ),
        ),
      ),
    ],
  );
  Widget _review() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.file(
          File(captured!.path),
          height: 420,
          fit: BoxFit.contain,
        ),
      ),
      const SizedBox(height: 16),
      Card(
        color: quality!.acceptable
            ? Colors.green.shade50
            : Colors.orange.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                quality!.acceptable
                    ? 'Image Quality Good'
                    : 'Retake recommended',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              if (quality!.messages.isEmpty)
                const Text(
                  'Resolution, brightness and sharpness checks passed.',
                )
              else
                ...quality!.messages.map((message) => Text('• $message')),
              const SizedBox(height: 8),
              Text(
                '${quality!.width} × ${quality!.height} • brightness ${quality!.brightness.toStringAsFixed(2)} • sharpness ${quality!.sharpness.toStringAsFixed(3)}',
              ),
            ],
          ),
        ),
      ),
      Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => setState(() {
                captured = null;
                quality = null;
              }),
              child: const Text('Retake'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: quality!.acceptable ? _queue : null,
              child: const Text('Continue'),
            ),
          ),
        ],
      ),
    ],
  );
}

class _PaperGuide extends StatelessWidget {
  const _PaperGuide();
  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 42),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white, width: 2),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: EdgeInsets.all(12),
            child: Text(
              'Align the full mark sheet inside the frame',
              style: TextStyle(
                color: Colors.white,
                backgroundColor: Colors.black54,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
