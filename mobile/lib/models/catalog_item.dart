class CatalogItem {
  const CatalogItem({required this.id, required this.label, required this.raw});
  final String id;
  final String label;
  final Map<String, dynamic> raw;
  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
    id: json['id'] as String,
    label:
        (json['name'] ?? json['title'] ?? json['displayName'] ?? json['code'])
            as String,
    raw: json,
  );
}
