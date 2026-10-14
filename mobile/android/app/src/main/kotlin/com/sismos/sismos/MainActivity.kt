package com.sismos.sismos

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "quake_alerts",
                "Sismos cercanos",
                NotificationManager.IMPORTANCE_HIGH,
            )
            channel.description = "Avisos cuando hay un sismo cerca de tu última ubicación"
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
