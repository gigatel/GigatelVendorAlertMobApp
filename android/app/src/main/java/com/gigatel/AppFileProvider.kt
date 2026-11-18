package com.gigatel

import androidx.core.content.FileProvider

// Keep the APK installer provider separate from document preview's provider.
class AppFileProvider : FileProvider()
