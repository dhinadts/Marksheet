class AppConfig {
  const AppConfig._();
  static const ec2ApiBaseUrl = 'http://3.6.211.24:3001';
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );
}
