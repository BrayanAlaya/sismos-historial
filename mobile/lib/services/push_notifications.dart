import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

enum QuakePushStatus { enabled, disabled, unavailable }

Future<QuakePushStatus> quakePushStatus() async {
  if (kIsWeb || !Platform.isAndroid) return QuakePushStatus.unavailable;
  try {
    await Firebase.initializeApp();
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    final enabled =
        settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
    return enabled ? QuakePushStatus.enabled : QuakePushStatus.disabled;
  } catch (_) {
    return QuakePushStatus.unavailable;
  }
}

String quakePushStatusLabel(QuakePushStatus status) {
  return switch (status) {
    QuakePushStatus.enabled => 'Activadas',
    QuakePushStatus.disabled => 'No activadas',
    QuakePushStatus.unavailable => 'No disponibles en este equipo',
  };
}

Future<void> startQuakePush() async {
  if (kIsWeb || !Platform.isAndroid) return;

  try {
    await Firebase.initializeApp();
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    final token = await messaging.getToken();
    if (token != null) await _saveToken(token);
    messaging.onTokenRefresh.listen(_saveToken);
  } catch (_) {}
}

Future<void> stopQuakePush() async {
  if (kIsWeb || !Platform.isAndroid) return;

  try {
    final messaging = FirebaseMessaging.instance;
    final token = await messaging.getToken();
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (token != null && userId != null) {
      await Supabase.instance.client
          .from('device_tokens')
          .delete()
          .eq('token', token);
    }
    await messaging.deleteToken();
  } catch (_) {}
}

Future<void> _saveToken(String token) async {
  final userId = Supabase.instance.client.auth.currentUser?.id;
  if (userId == null) return;
  await Supabase.instance.client.from('device_tokens').upsert({
    'token': token,
    'user_id': userId,
    'platform': 'android',
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  });
}
