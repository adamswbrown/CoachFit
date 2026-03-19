package com.askadam.coachfit.data.remote

import com.google.gson.annotations.SerializedName

// === Auth ===

data class PairRequest(
    val code: String
)

data class PairResponse(
    val success: Boolean?,
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("client_id") val clientId: String,
    val coach: PairPerson?,
    val client: PairPerson?
)

data class PairPerson(
    val id: String?,
    val name: String?,
    val email: String?
)

data class RegisterDeviceRequest(
    val clerkToken: String
)

data class RegisterDeviceResponse(
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("client_id") val clientId: String,
    @SerializedName("client_name") val clientName: String?,
    @SerializedName("coach_name") val coachName: String?
)

// === Check-in Entry ===

data class SubmitEntryRequest(
    @SerializedName("client_id") val clientId: String,
    val date: String,
    val weightLbs: Double?,
    val steps: Int?,
    val calories: Int?,
    val sleepQuality: Int?,
    val perceivedStress: Int?,
    val notes: String?
)

// === Workouts ===

data class WorkoutsPayload(
    @SerializedName("client_id") val clientId: String,
    val workouts: List<WorkoutRecord>
)

data class WorkoutRecord(
    @SerializedName("workout_type") val workoutType: String,
    @SerializedName("start_time") val startTime: String,
    @SerializedName("end_time") val endTime: String,
    @SerializedName("duration_seconds") val durationSeconds: Double,
    @SerializedName("calories_active") val caloriesActive: Double?,
    @SerializedName("distance_meters") val distanceMeters: Double?,
    @SerializedName("avg_heart_rate") val avgHeartRate: Double?,
    @SerializedName("max_heart_rate") val maxHeartRate: Double?,
    @SerializedName("source_device") val sourceDevice: String?
)

// === Sleep ===

data class SleepPayload(
    @SerializedName("client_id") val clientId: String,
    @SerializedName("sleep_records") val sleepRecords: List<SleepRecord>
)

data class SleepRecord(
    val date: String,
    @SerializedName("total_sleep_minutes") val totalSleepMinutes: Int,
    @SerializedName("in_bed_minutes") val inBedMinutes: Int?,
    @SerializedName("awake_minutes") val awakeMinutes: Int?,
    @SerializedName("asleep_core_minutes") val asleepCoreMinutes: Int?,
    @SerializedName("asleep_deep_minutes") val asleepDeepMinutes: Int?,
    @SerializedName("asleep_rem_minutes") val asleepRemMinutes: Int?,
    @SerializedName("sleep_start") val sleepStart: String?,
    @SerializedName("sleep_end") val sleepEnd: String?,
    @SerializedName("source_devices") val sourceDevices: List<String>?
)

// === Steps ===

data class StepsPayload(
    @SerializedName("client_id") val clientId: String,
    val steps: List<DailyStepsRecord>
)

data class DailyStepsRecord(
    val date: String,
    @SerializedName("total_steps") val totalSteps: Int
)

// === Profile ===

data class ProfilePayload(
    @SerializedName("client_id") val clientId: String,
    val metrics: List<ProfileMetric>
)

data class ProfileMetric(
    val metric: String,
    val value: Double,
    val unit: String,
    @SerializedName("measured_at") val measuredAt: String
)

// === Nutrition / Cronometer ===

data class NutritionPayload(
    @SerializedName("client_id") val clientId: String,
    val rows: List<NutritionRow>
)

data class NutritionRow(
    val date: String,
    val calories: Int?,
    val proteinGrams: Double?,
    val carbsGrams: Double?,
    val fatGrams: Double?,
    val fiberGrams: Double?
)

// === Streak ===

data class StreakResponse(
    val currentStreak: Int,
    val longestStreak: Int,
    val lastCheckInDate: String?,
    val milestones: List<Milestone>?
)

data class Milestone(
    val id: String,
    val title: String,
    val description: String?,
    val type: String,
    val targetValue: Int?,
    val achievedAt: String?,
    val coachMessage: String?,
    val coachName: String?
)
