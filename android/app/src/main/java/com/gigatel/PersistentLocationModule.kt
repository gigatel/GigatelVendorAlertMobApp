package com.gigatel.vendor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

class PersistentLocationModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val LOG_EVENT = "PersistentLocationLog"

        @Volatile
        private var activeContext = WeakReference<ReactApplicationContext>(null)

        fun emitLog(message: String): Boolean {
            val context = activeContext.get() ?: return false
            if (!context.hasActiveReactInstance()) return false
            context.runOnUiQueueThread {
                if (context.hasActiveReactInstance()) {
                    context
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit(LOG_EVENT, message)
                }
            }
            return true
        }
    }

    init {
        activeContext = WeakReference(reactContext)
    }

    override fun getName() = "PersistentLocation"

    // Required by React Native's NativeEventEmitter contract.
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Int) = Unit

    @ReactMethod
    fun start(options: ReadableMap, promise: Promise) {
        try {
            val token = options.getString("token").orEmpty()
            val endpoint = options.getString("endpoint").orEmpty()
            val employeeId = options.getDouble("employeeId").toLong()
            val companyId = options.getDouble("companyId").toLong()
            val intervalMs = if (options.hasKey("intervalMs")) {
                options.getDouble("intervalMs").toLong()
            } else {
                60_000L
            }

            if (token.isBlank() || endpoint.isBlank() || employeeId <= 0L || companyId <= 0L) {
                promise.reject("INVALID_LOCATION_CONFIG", "Missing location API configuration")
                return
            }
            if (!hasForegroundLocationPermission()) {
                promise.reject("LOCATION_PERMISSION_REQUIRED", "Location permission is required")
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundPermission()) {
                promise.reject(
                    "BACKGROUND_LOCATION_PERMISSION_REQUIRED",
                    "Allow all the time location permission is required",
                )
                return
            }

            reactContext.getSharedPreferences(
                PersistentLocationService.PREFS_NAME,
                ReactApplicationContext.MODE_PRIVATE,
            ).edit()
                .putBoolean(PersistentLocationService.KEY_ENABLED, true)
                .putString(PersistentLocationService.KEY_ENDPOINT, endpoint)
                .putString(PersistentLocationService.KEY_TOKEN, token)
                .putLong(PersistentLocationService.KEY_EMPLOYEE_ID, employeeId)
                .putLong(PersistentLocationService.KEY_COMPANY_ID, companyId)
                .putLong(PersistentLocationService.KEY_INTERVAL_MS, intervalMs)
                .commit()

            val intent = Intent(reactContext, PersistentLocationService::class.java).apply {
                action = PersistentLocationService.ACTION_START
            }
            ContextCompat.startForegroundService(reactContext, intent)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("LOCATION_SERVICE_START_FAILED", error)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            reactContext.getSharedPreferences(
                PersistentLocationService.PREFS_NAME,
                ReactApplicationContext.MODE_PRIVATE,
            ).edit().putBoolean(PersistentLocationService.KEY_ENABLED, false).commit()
            reactContext.stopService(Intent(reactContext, PersistentLocationService::class.java))
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("LOCATION_SERVICE_STOP_FAILED", error)
        }
    }

    @ReactMethod
    fun isRunning(promise: Promise) = promise.resolve(PersistentLocationService.isRunning)

    override fun invalidate() {
        if (activeContext.get() === reactContext) {
            activeContext.clear()
        }
        super.invalidate()
    }

    private fun hasForegroundLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasBackgroundPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    }
}