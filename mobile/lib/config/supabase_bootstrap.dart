import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_settings.dart';

Future<void> connectSupabase(SupabaseSettings settings) async {
  var already = false;
  try {
    already = Supabase.instance.isInitialized;
  } on AssertionError {
    already = false;
  }

  if (already) {
    await Supabase.instance.dispose();
  }

  await Supabase.initialize(
    url: settings.url.trim(),
    publishableKey: settings.anonKey.trim(),
  );
}
