package com.gigatel.vendor

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class PersistentLocationService : Service(), LocationListener {
    companion object {
        const val ACTION_START = "com.gigatel.vendor.location.START"
        const val ACTION_STOP = "com.gigatel.vendor.location.STOP"
        const val PREFS_NAME = "persistent_location"
        const val KEY_ENABLED = "enabled"
        const val KEY_ENDPOINT = "endpoint"
        const val KEY_TOKEN = "token"
        const val KEY_EMPLOYEE_ID = "employee_id"
        const val KEY_COMPANY_ID = "company_id"
        const val KEY_INTERVAL_MS = "interval_ms"

        private const val TAG = "PersistentLocation"
        private const val REACT_NATIVE_LOG_TAG = "ReactNativeJS"
        private const val CHANNEL_ID = "gigatel_persistent_location"
        private const val NOTIFICATION_ID = 40902   
        private const val DEFAULT_INTERVAL_MS = 60_000L
        private const val DEFAULT_ENDPOINT =
            "http://mob.gigatel.me:40902/api/Location/PostLocation"

        @Volatile
        var isRunning = false
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private val networkExecutor = Executors.newSingleThreadExecutor()
    private val posting = AtomicBoolean(false)
    private lateinit var locationManager: LocationManager
    private var lastLocation: Location? = null
    private var lastPostTime = 0L

    private val postRunnable = object : Runnable {
        override fun run() {
            lastLocation?.let(::postLocationIfDue)
            handler.postDelayed(this, configuredInterval())
        }
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            preferences().edit().putBoolean(KEY_ENABLED, false).apply()
            stopTracking()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (!preferences().getBoolean(KEY_ENABLED, false)) {
            stopSelf()
            return START_NOT_STICKY
        }

        startAsForegroundService()
        startTracking()
        return START_STICKY
    }

    private fun startAsForegroundService() {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background location tracking",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps work-location sharing active"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("GTPL Vendor location sharing is active")
            .setContentText("Location is sent for assigned work, including in background")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
        isRunning = true
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    }

    @Suppress("MissingPermission")
    private fun startTracking() {
        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission missing; stopping service")
            stopSelf()
            return
        }

        locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let {
            lastLocation = it
        }
        locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let {
            if (lastLocation == null || it.time > (lastLocation?.time ?: 0L)) {
                lastLocation = it
            }
        }

        requestProvider(LocationManager.GPS_PROVIDER)
        requestProvider(LocationManager.NETWORK_PROVIDER)
        handler.removeCallbacks(postRunnable)
        handler.post(postRunnable)
    }

    @Suppress("MissingPermission")
    private fun requestProvider(provider: String) {
        if (!locationManager.isProviderEnabled(provider)) return
        try {
            locationManager.requestLocationUpdates(
                provider,
                15_000L,
                5f,
                this,
                Looper.getMainLooper(),
            )
        } catch (error: Exception) {
            Log.w(TAG, "Unable to subscribe to $provider", error)
        }
    }

    override fun onLocationChanged(location: Location) {
        lastLocation = location
        postLocationIfDue(location)
    }

    @Deprecated("Deprecated in Android SDK")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = requestProvider(provider)

    override fun onProviderDisabled(provider: String) = Unit

    private fun postLocationIfDue(location: Location) {
        val now = System.currentTimeMillis()
        if (now - lastPostTime < configuredInterval() || !posting.compareAndSet(false, true)) {
            return
        }
        lastPostTime = now

        networkExecutor.execute {
            try {
                postLocation(location)
            } catch (error: Exception) {
                Log.w(TAG, "Location post failed", error)
                // Permit the next periodic tick to retry quickly after a failure.
                lastPostTime = 0L
            } finally {
                posting.set(false)
            }
        }
    }

    private fun postLocation(location: Location) {
        val prefs = preferences()
        val endpoint = prefs.getString(KEY_ENDPOINT, DEFAULT_ENDPOINT) ?: DEFAULT_ENDPOINT
        val token = prefs.getString(KEY_TOKEN, "").orEmpty()
        val employeeId = prefs.getLong(KEY_EMPLOYEE_ID, 0L)
        val companyId = prefs.getLong(KEY_COMPANY_ID, 0L)
        if (token.isBlank() || employeeId <= 0L || companyId <= 0L) {
            Log.w(TAG, "Missing API credentials; skipping location post")
            return
        }

        val batteryManager = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val batteryLevel = batteryManager
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            .coerceIn(0, 100)
        val formatter = SimpleDateFormat("dd-MM-yyyy HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("Asia/Kolkata")
        }
        val payload = JSONObject().apply {
            put("token", token)
            put("employeeID", employeeId)
            put("address", "")
            put("batteryStatus", "$batteryLevel%")
            put("delay", "0")
            put("dateTime", formatter.format(Date()))
            put("distance", 0)
            put("dutyStatus", "")
            put("latitude", location.latitude.toString())
            put("longitude", location.longitude.toString())
            put("companyId", companyId)
        }

        val requestPayload = payload.toString()
        if (BuildConfig.DEBUG && !PersistentLocationModule.emitLog(requestPayload)) {
            Log.i(REACT_NATIVE_LOG_TAG, requestPayload)
        }

        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            connection.outputStream.use { output ->
                output.write(requestPayload.toByteArray(Charsets.UTF_8))
            }
            val responseCode = connection.responseCode
            if (responseCode !in 200..299) {
                Log.w(TAG, "PostLocation response: HTTP $responseCode")
                throw IllegalStateException("Location API returned HTTP $responseCode")
            }
            Log.i(TAG, "PostLocation response: HTTP $responseCode (success)")
        } finally {
            connection.disconnect()
        }
    }

    private fun configuredInterval(): Long {
        return preferences()
            .getLong(KEY_INTERVAL_MS, DEFAULT_INTERVAL_MS)
            .coerceAtLeast(60_000L)
    }

    private fun preferences() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun stopTracking() {
        handler.removeCallbacksAndMessages(null)
        if (::locationManager.isInitialized) {
            locationManager.removeUpdates(this)
        }
        isRunning = false
    }

    override fun onDestroy() {
        stopTracking()
        networkExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
