import 'package:dio/dio.dart';
import '../models/catalog_item.dart';

class AcademicRepository {
  AcademicRepository(this._dio);
  final Dio _dio;
  Future<List<CatalogItem>> catalog(String resource) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/catalog/$resource',
      queryParameters: {'page': 1, 'pageSize': 100, 'status': 'ACTIVE'},
    );
    final rows = response.data?['data'] as List<dynamic>? ?? const [];
    return rows
        .map((row) => CatalogItem.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  Future<List<CatalogItem>> publishedPapers(String subjectId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/question-papers',
      queryParameters: {'page': 1, 'pageSize': 100, 'status': 'ACTIVE'},
    );
    final rows = response.data?['data'] as List<dynamic>? ?? const [];
    return rows
        .where((row) => (row as Map<String, dynamic>)['subjectId'] == subjectId)
        .map((row) {
          final paper = Map<String, dynamic>.from(row as Map<String, dynamic>);
          final versions = paper['versions'] as List<dynamic>? ?? const [];
          final published = versions.cast<Map<String, dynamic>>().where(
            (version) =>
                version['status'] == 'PUBLISHED' &&
                version['markingSchemeVersionId'] != null,
          );
          if (published.isEmpty) return null;
          final version = published.first;
          return CatalogItem(
            id: version['id'] as String,
            label: '${paper['title']} (v${version['version']})',
            raw: {
              ...paper,
              'questionPaperVersionId': version['id'],
              'markingSchemeVersionId': version['markingSchemeVersionId'],
            },
          );
        })
        .whereType<CatalogItem>()
        .toList();
  }
}
