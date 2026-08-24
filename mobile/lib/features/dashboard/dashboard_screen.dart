import 'package:flutter/material.dart';
import '../../providers/providers.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI-MARKS'),
        actions: [
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
              leading: const CircleAvatar(
                child: Icon(Icons.camera_alt_outlined),
              ),
              title: const Text('New mark-sheet capture'),
              subtitle: const Text(
                'Guided camera and on-device quality preflight',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/select'),
            ),
          ),
          const Card(
            child: ListTile(
              leading: CircleAvatar(child: Icon(Icons.sync)),
              title: Text('Offline queue'),
              subtitle: Text(
                'Pending uploads will appear here when Phase 8 upload APIs are available.',
              ),
            ),
          ),

            const Card(
            child: ListTile(
              leading: CircleAvatar(child: Icon(Icons.sync)),
              title: Text('LIST OF CATURED MARKSHEETS'),
              subtitle: Text(
                'List of captured marksheets will appear here when Phase 8 upload APIs are available.',
              ),
            ),
          ),
       
        ],
      ),
    );
  }
}
