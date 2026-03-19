# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.askadam.coachfit.data.remote.** { *; }
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn retrofit2.**

# Gson
-keep class com.google.gson.** { *; }
-keepattributes AnnotationDefault,RuntimeVisibleAnnotations

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
