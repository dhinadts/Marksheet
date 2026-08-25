class AppConfig {
  const AppConfig._();
  static const ec2ApiBaseUrl = 'https://api.dhinadts.com';
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: ec2ApiBaseUrl,
  );
}
