import 'package:flutter/material.dart';

const kBackground = Color(0xFF0A101C);
const kMuted = Color(0xFF94A3B8);
const kKicker = Color(0xFF7DD3FC);
const kAccent = Color(0xFF0369A1);

const kOverlayDecoration = BoxDecoration(
  color: Color(0xE00A101C),
  borderRadius: BorderRadius.all(Radius.circular(18)),
  border: Border.fromBorderSide(BorderSide(color: Color(0x2E94A3B8))),
  boxShadow: [
    BoxShadow(
      color: Color(0x59000000),
      blurRadius: 24,
      offset: Offset(0, 12),
    ),
  ],
);

ThemeData buildAppTheme() {
  const scheme = ColorScheme.dark(
    surface: kBackground,
    primary: kKicker,
    secondary: kAccent,
    error: Color(0xFFF87171),
  );

  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: const BorderSide(color: Color(0xFF334155)),
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBackground,
    textTheme: ThemeData(brightness: Brightness.dark).textTheme.apply(
      bodyColor: const Color(0xFFE8EEF7),
      displayColor: const Color(0xFFE8EEF7),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kBackground,
      foregroundColor: Color(0xFFE8EEF7),
      elevation: 0,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF111827),
      labelStyle: const TextStyle(color: kMuted),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: kKicker),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kAccent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
  );
}
