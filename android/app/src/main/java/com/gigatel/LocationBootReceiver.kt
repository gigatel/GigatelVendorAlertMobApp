package com.gigatel.vendor

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

class LocationBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val supportedAction = intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (!supportedAction) return

        val prefs = context.getSharedPreferences(
            PersistentLocationService.PREFS_NAME,
            Context.MODE_PRIVATE,
        )
        if (!prefs.getBoolean(PersistentLocationService.KEY_ENABLED, false)) return

        val foregroundGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val backgroundGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
        if (!foregroundGranted || !backgroundGranted) return

        val serviceIntent = Intent(context, PersistentLocationService::class.java).apply {
            action = PersistentLocationService.ACTION_START
        }
        try {
            ContextCompat.startForegroundService(context, serviceIntent)
        } catch (_: Exception) {
            // The app will retry from its next visible activity.
        }
    }
}