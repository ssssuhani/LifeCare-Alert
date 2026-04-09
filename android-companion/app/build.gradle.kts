plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.lifecare.phonecompanion"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.lifecare.phonecompanion"
    minSdk = 26
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"

    buildConfigField("String", "SUPABASE_URL", "\"${property("SUPABASE_URL")}\"")
    buildConfigField("String", "SUPABASE_ANON_KEY", "\"${property("SUPABASE_ANON_KEY")}\"")
    buildConfigField("String", "SUPABASE_TABLE", "\"${property("SUPABASE_TABLE")}\"")
    buildConfigField("String", "DEFAULT_PATIENT_ID", "\"${property("DEFAULT_PATIENT_ID")}\"")
    buildConfigField("String", "DEFAULT_DEVICE_ID", "\"${property("DEFAULT_DEVICE_ID")}\"")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.14"
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.06.00")

  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.activity:activity-compose:1.9.1")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.3")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")

  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")

  implementation("com.google.android.gms:play-services-location:21.3.0")

  debugImplementation("androidx.compose.ui:ui-tooling")
  debugImplementation("androidx.compose.ui:ui-test-manifest")
}
