class CatalogItem {
  const CatalogItem({required this.id, required this.label, required this.raw});
  final String id;
  final String label;
  final Map<String, dynamic> raw;
  factory CatalogItem.fromJson(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    if (id == null || id.isEmpty) {
      throw const FormatException('Catalog record is missing an id');
    }
    final label =
        json['name'] ??
        json['title'] ??
        json['displayName'] ??
        json['fullName'] ??
        json['code'] ??
        json['registerNumber'] ??
        'Subject offering';
    return CatalogItem(id: id, label: label.toString(), raw: json);
  }
}
