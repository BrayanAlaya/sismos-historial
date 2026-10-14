import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class SupabaseSettings {
  const SupabaseSettings({
    required this.url,
    required this.anonKey,
    this.fromEnvironment = false,
  });

  final String url;
  final String anonKey;
  final bool fromEnvironment;

  static const _urlKey = 'supabase_url';
  static const _anonKeyKey = 'supabase_anon_key';

  bool get isConfigured {
    final uri = Uri.tryParse(url.trim());
    return uri != null &&
        uri.isScheme('https') &&
        uri.host.contains('.') &&
        anonKey.trim().length >= 20 &&
        !looksLikeSecretKey(anonKey);
  }

  static const defaultUrl = 'https://rhsdwxujrixouvywhpha.supabase.co';
  static const defaultAnonKey =
      'sb_publishable_V3fukBbLb58m6Gg3lD3lZQ_DjMmd9Ei';

  static SupabaseSettings fromDefines() {
    return const SupabaseSettings(
      url: String.fromEnvironment('SUPABASE_URL', defaultValue: defaultUrl),
      anonKey: String.fromEnvironment(
        'SUPABASE_ANON_KEY',
        defaultValue: defaultAnonKey,
      ),
      fromEnvironment: true,
    );
  }

  static Future<SupabaseSettings> load() async {
    final fromEnv = fromDefines();
    if (fromEnv.isConfigured) return fromEnv;

    final prefs = await SharedPreferences.getInstance();
    return SupabaseSettings(
      url: prefs.getString(_urlKey) ?? '',
      anonKey: prefs.getString(_anonKeyKey) ?? '',
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_urlKey, url.trim());
    await prefs.setString(_anonKeyKey, anonKey.trim());
  }

  static Future<void> clearSaved() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_urlKey);
    await prefs.remove(_anonKeyKey);
  }
}

bool looksLikeSecretKey(String key) {
  final trimmed = key.trim();
  if (trimmed.startsWith('sb_secret')) return true;

  final parts = trimmed.split('.');
  if (parts.length < 2) return false;

  try {
    final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
    return payload.contains('service_role');
  } catch (_) {
    return false;
  }
}
