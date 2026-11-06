plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
// versionCode lives in android/version.txt (release tag android-N). Bump it for every new shell release.
val code = (System.getenv("VERSION_CODE") ?: rootProject.file("version.txt").readText().trim()).toInt()
// The signing key never lives in this public repo. CI signs only when BRIZNA_KS_FILE / BRIZNA_KS_PASS exist;
// otherwise it builds an unsigned APK that is signed privately with the same key.
val ksFile = System.getenv("BRIZNA_KS_FILE")
val ksPass = System.getenv("BRIZNA_KS_PASS")
android {
    namespace = "com.oscarvelz.brizna"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.oscarvelz.brizna"
        minSdk = 30
        targetSdk = 34
        versionCode = code
        versionName = "1.$code"
    }
    if (!ksFile.isNullOrBlank() && !ksPass.isNullOrBlank()) {
        signingConfigs {
            create("rel") {
                storeFile = file(ksFile)
                storePassword = ksPass
                keyAlias = "brizna"
                keyPassword = ksPass
                storeType = "pkcs12"
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (!ksFile.isNullOrBlank() && !ksPass.isNullOrBlank()) signingConfig = signingConfigs.getByName("rel")
        }
    }
    buildFeatures { buildConfig = true }
    lint { checkReleaseBuilds = false; abortOnError = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.core:core:1.13.1")
}
