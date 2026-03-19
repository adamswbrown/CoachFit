package com.askadam.coachfit.health

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Volume
import com.askadam.coachfit.data.remote.SleepRecord
import com.askadam.coachfit.data.remote.WorkoutRecord
import com.askadam.coachfit.util.DateUtils
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

data class DailyHealthSummary(
    val date: String,
    val steps: Int? = null,
    val activeCalories: Int? = null,
    val basalCalories: Int? = null,
    val totalCaloriesBurned: Int? = null,
    val distanceMeters: Int? = null,
    val exerciseMinutes: Int? = null,
    val weight: Double? = null,
    val bodyFatPercentage: Double? = null,
    val sleepMinutes: Int? = null,
    val waterLiters: Double? = null
)

data class TodayHealthData(
    val steps: Int? = null,
    val weightLbs: Double? = null,
    val weightDate: Instant? = null,
    val recentWorkouts: List<WorkoutRecord> = emptyList(),
    val lastNightSleep: SleepRecord? = null
)

@Singleton
class HealthConnectManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "HealthConnectManager"

        val READ_PERMISSIONS = setOf(
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(HeightRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(BodyFatRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(FloorsClimbedRecord::class),
            HealthPermission.getReadPermission(HydrationRecord::class),
        )

        val WRITE_PERMISSIONS = setOf(
            HealthPermission.getWritePermission(NutritionRecord::class),
            HealthPermission.getWritePermission(HydrationRecord::class),
            HealthPermission.getWritePermission(WeightRecord::class),
        )

        val ALL_PERMISSIONS = READ_PERMISSIONS + WRITE_PERMISSIONS
    }

    private val client: HealthConnectClient? by lazy {
        try {
            HealthConnectClient.getOrCreate(context)
        } catch (e: Exception) {
            Log.e(TAG, "Health Connect not available", e)
            null
        }
    }

    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    suspend fun hasAllPermissions(): Boolean {
        val hc = client ?: return false
        val granted = hc.permissionController.getGrantedPermissions()
        return ALL_PERMISSIONS.all { it in granted }
    }

    // === Fetch today's data for check-in ===

    suspend fun fetchTodayData(): TodayHealthData {
        val hc = client ?: return TodayHealthData()
        val today = LocalDate.now()
        val startOfDay = DateUtils.startOfDay(today)
        val now = Instant.now()

        return try {
            val steps = fetchTodaySteps(hc, startOfDay, now)
            val weight = fetchLatestWeight(hc, 30)
            val workouts = fetchWorkoutsSince(hc, startOfDay)
            val sleep = fetchSleepLastNight(hc)

            TodayHealthData(
                steps = steps,
                weightLbs = weight?.first,
                weightDate = weight?.second,
                recentWorkouts = workouts,
                lastNightSleep = sleep
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching today data", e)
            TodayHealthData()
        }
    }

    private suspend fun fetchTodaySteps(hc: HealthConnectClient, start: Instant, end: Instant): Int? {
        val response = hc.aggregate(
            AggregateRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        )
        return response[StepsRecord.COUNT_TOTAL]?.toInt()
    }

    private suspend fun fetchLatestWeight(hc: HealthConnectClient, lookbackDays: Long): Pair<Double, Instant>? {
        val start = DateUtils.daysAgo(lookbackDays)
        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.after(start)
            )
        )
        val latest = response.records.maxByOrNull { it.time }
        return latest?.let {
            val lbs = it.weight.inKilograms * 2.20462
            lbs to it.time
        }
    }

    private suspend fun fetchWorkoutsSince(hc: HealthConnectClient, since: Instant): List<WorkoutRecord> {
        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.after(since)
            )
        )
        return response.records.map { session ->
            val duration = Duration.between(session.startTime, session.endTime)
            WorkoutRecord(
                workoutType = mapExerciseType(session.exerciseType),
                startTime = DateUtils.toIsoString(session.startTime),
                endTime = DateUtils.toIsoString(session.endTime),
                durationSeconds = duration.seconds.toDouble(),
                caloriesActive = null,
                distanceMeters = null,
                avgHeartRate = null,
                maxHeartRate = null,
                sourceDevice = session.metadata.dataOrigin.packageName
            )
        }
    }

    private suspend fun fetchSleepLastNight(hc: HealthConnectClient): SleepRecord? {
        val yesterday = LocalDate.now().minusDays(1)
        val start = yesterday.atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant()
        val end = LocalDate.now().atTime(14, 0).atZone(ZoneId.systemDefault()).toInstant()

        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        )

        if (response.records.isEmpty()) return null

        var totalSleepMinutes = 0
        var inBedMinutes = 0
        var awakeMinutes = 0
        var coreMinutes = 0
        var deepMinutes = 0
        var remMinutes = 0
        var sleepStart: Instant? = null
        var sleepEnd: Instant? = null
        val sourceDevices = mutableSetOf<String>()

        for (session in response.records) {
            val sessionDuration = Duration.between(session.startTime, session.endTime).toMinutes().toInt()

            if (sleepStart == null || session.startTime.isBefore(sleepStart)) {
                sleepStart = session.startTime
            }
            if (sleepEnd == null || session.endTime.isAfter(sleepEnd)) {
                sleepEnd = session.endTime
            }

            sourceDevices.add(session.metadata.dataOrigin.packageName)

            for (stage in session.stages) {
                val stageMinutes = Duration.between(stage.startTime, stage.endTime).toMinutes().toInt()
                when (stage.stage) {
                    SleepSessionRecord.STAGE_TYPE_AWAKE -> awakeMinutes += stageMinutes
                    SleepSessionRecord.STAGE_TYPE_LIGHT -> coreMinutes += stageMinutes
                    SleepSessionRecord.STAGE_TYPE_DEEP -> deepMinutes += stageMinutes
                    SleepSessionRecord.STAGE_TYPE_REM -> remMinutes += stageMinutes
                    SleepSessionRecord.STAGE_TYPE_SLEEPING -> coreMinutes += stageMinutes
                }
            }

            if (session.stages.isEmpty()) {
                totalSleepMinutes += sessionDuration
            }

            inBedMinutes += sessionDuration
        }

        if (totalSleepMinutes == 0) {
            totalSleepMinutes = coreMinutes + deepMinutes + remMinutes
        }

        return SleepRecord(
            date = DateUtils.formatDate(LocalDate.now()),
            totalSleepMinutes = totalSleepMinutes,
            inBedMinutes = inBedMinutes,
            awakeMinutes = awakeMinutes,
            asleepCoreMinutes = coreMinutes,
            asleepDeepMinutes = deepMinutes,
            asleepRemMinutes = remMinutes,
            sleepStart = sleepStart?.let { DateUtils.toIsoString(it) },
            sleepEnd = sleepEnd?.let { DateUtils.toIsoString(it) },
            sourceDevices = sourceDevices.toList()
        )
    }

    // === Fetch for sync ===

    suspend fun fetchWorkouts(since: Instant): List<WorkoutRecord> {
        val hc = client ?: return emptyList()
        return fetchWorkoutsSince(hc, since)
    }

    suspend fun fetchSleepRecords(since: Instant): List<SleepRecord> {
        val hc = client ?: return emptyList()
        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.after(since)
            )
        )

        // Group by date
        val byDate = response.records.groupBy { record ->
            record.endTime.atZone(ZoneId.systemDefault()).toLocalDate()
        }

        return byDate.map { (date, sessions) ->
            var totalSleep = 0
            var inBed = 0
            var awake = 0
            var core = 0
            var deep = 0
            var rem = 0
            var sleepStart: Instant? = null
            var sleepEnd: Instant? = null
            val sources = mutableSetOf<String>()

            for (session in sessions) {
                val dur = Duration.between(session.startTime, session.endTime).toMinutes().toInt()
                inBed += dur
                if (sleepStart == null || session.startTime.isBefore(sleepStart)) sleepStart = session.startTime
                if (sleepEnd == null || session.endTime.isAfter(sleepEnd)) sleepEnd = session.endTime
                sources.add(session.metadata.dataOrigin.packageName)

                for (stage in session.stages) {
                    val stageMin = Duration.between(stage.startTime, stage.endTime).toMinutes().toInt()
                    when (stage.stage) {
                        SleepSessionRecord.STAGE_TYPE_AWAKE -> awake += stageMin
                        SleepSessionRecord.STAGE_TYPE_LIGHT, SleepSessionRecord.STAGE_TYPE_SLEEPING -> core += stageMin
                        SleepSessionRecord.STAGE_TYPE_DEEP -> deep += stageMin
                        SleepSessionRecord.STAGE_TYPE_REM -> rem += stageMin
                    }
                }
            }

            totalSleep = core + deep + rem

            SleepRecord(
                date = DateUtils.formatDate(date),
                totalSleepMinutes = totalSleep,
                inBedMinutes = inBed,
                awakeMinutes = awake,
                asleepCoreMinutes = core,
                asleepDeepMinutes = deep,
                asleepRemMinutes = rem,
                sleepStart = sleepStart?.let { DateUtils.toIsoString(it) },
                sleepEnd = sleepEnd?.let { DateUtils.toIsoString(it) },
                sourceDevices = sources.toList()
            )
        }
    }

    suspend fun fetchDailySteps(since: Instant): List<Pair<String, Int>> {
        val hc = client ?: return emptyList()
        val result = mutableListOf<Pair<String, Int>>()

        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.after(since)
            )
        )

        // Group by date and sum
        val byDate = response.records.groupBy { record ->
            record.startTime.atZone(ZoneId.systemDefault()).toLocalDate()
        }

        for ((date, records) in byDate) {
            val total = records.sumOf { it.count.toInt() }
            result.add(DateUtils.formatDate(date) to total)
        }

        return result
    }

    suspend fun fetchWeightRecords(since: Instant): List<Triple<Double, String, Instant>> {
        val hc = client ?: return emptyList()
        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.after(since)
            )
        )
        return response.records.map { record ->
            Triple(record.weight.inKilograms, "kg", record.time)
        }
    }

    suspend fun fetchHeightRecords(since: Instant): List<Triple<Double, String, Instant>> {
        val hc = client ?: return emptyList()
        val response = hc.readRecords(
            ReadRecordsRequest(
                recordType = HeightRecord::class,
                timeRangeFilter = TimeRangeFilter.after(since)
            )
        )
        return response.records.map { record ->
            Triple(record.height.inMeters, "m", record.time)
        }
    }

    // === Fetch daily summary ===

    suspend fun fetchDailySummary(date: LocalDate): DailyHealthSummary {
        val hc = client ?: return DailyHealthSummary(date = DateUtils.formatDate(date))
        val start = DateUtils.startOfDay(date)
        val end = DateUtils.endOfDay(date)
        val timeRange = TimeRangeFilter.between(start, end)

        val aggregateResponse = hc.aggregate(
            AggregateRequest(
                metrics = setOf(
                    StepsRecord.COUNT_TOTAL,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                    DistanceRecord.DISTANCE_TOTAL,
                ),
                timeRangeFilter = timeRange
            )
        )

        val steps = aggregateResponse[StepsRecord.COUNT_TOTAL]?.toInt()
        val activeCal = aggregateResponse[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories?.toInt()
        val distance = aggregateResponse[DistanceRecord.DISTANCE_TOTAL]?.inMeters?.toInt()

        // Weight
        val weightRecords = hc.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = timeRange
            )
        )
        val weight = weightRecords.records.lastOrNull()?.weight?.inKilograms

        // Body fat
        val bodyFatRecords = hc.readRecords(
            ReadRecordsRequest(
                recordType = BodyFatRecord::class,
                timeRangeFilter = timeRange
            )
        )
        val bodyFat = bodyFatRecords.records.lastOrNull()?.percentage?.value

        // Exercise minutes
        val exerciseRecords = hc.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = timeRange
            )
        )
        val exerciseMinutes = exerciseRecords.records.sumOf {
            Duration.between(it.startTime, it.endTime).toMinutes()
        }.toInt()

        // Sleep (look at previous night)
        val sleepStart = date.minusDays(1).atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant()
        val sleepEnd = date.atTime(14, 0).atZone(ZoneId.systemDefault()).toInstant()
        val sleepRecords = hc.readRecords(
            ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(sleepStart, sleepEnd)
            )
        )
        val sleepMinutes = sleepRecords.records.sumOf {
            Duration.between(it.startTime, it.endTime).toMinutes()
        }.toInt()

        // Hydration
        val hydrationRecords = hc.readRecords(
            ReadRecordsRequest(
                recordType = HydrationRecord::class,
                timeRangeFilter = timeRange
            )
        )
        val waterLiters = hydrationRecords.records.sumOf {
            it.volume.inLiters
        }

        return DailyHealthSummary(
            date = DateUtils.formatDate(date),
            steps = steps,
            activeCalories = activeCal,
            totalCaloriesBurned = activeCal, // simplified
            distanceMeters = distance,
            exerciseMinutes = if (exerciseMinutes > 0) exerciseMinutes else null,
            weight = weight,
            bodyFatPercentage = bodyFat,
            sleepMinutes = if (sleepMinutes > 0) sleepMinutes else null,
            waterLiters = if (waterLiters > 0) waterLiters else null
        )
    }

    suspend fun fetchWeekSummaries(): List<DailyHealthSummary> {
        val today = LocalDate.now()
        return (0L..6L).map { daysAgo ->
            fetchDailySummary(today.minusDays(daysAgo))
        }
    }

    // === Write operations ===

    suspend fun saveNutrition(calories: Double, protein: Double, fat: Double, carbs: Double, date: LocalDate) {
        val hc = client ?: return
        val start = DateUtils.startOfDay(date)
        val end = start.plusSeconds(1)

        val record = NutritionRecord(
            startTime = start,
            endTime = end,
            startZoneOffset = ZoneId.systemDefault().rules.getOffset(start),
            endZoneOffset = ZoneId.systemDefault().rules.getOffset(end),
            energy = Energy.kilocalories(calories),
            protein = Mass.grams(protein),
            totalFat = Mass.grams(fat),
            totalCarbohydrate = Mass.grams(carbs),
        )
        hc.insertRecords(listOf(record))
    }

    suspend fun saveWater(milliliters: Double, date: LocalDate) {
        val hc = client ?: return
        val start = DateUtils.startOfDay(date)
        val end = start.plusSeconds(1)

        val record = HydrationRecord(
            startTime = start,
            endTime = end,
            startZoneOffset = ZoneId.systemDefault().rules.getOffset(start),
            endZoneOffset = ZoneId.systemDefault().rules.getOffset(end),
            volume = Volume.milliliters(milliliters),
        )
        hc.insertRecords(listOf(record))
    }

    suspend fun saveWeight(kg: Double, date: LocalDate) {
        val hc = client ?: return
        val time = DateUtils.startOfDay(date)

        val record = WeightRecord(
            time = time,
            zoneOffset = ZoneId.systemDefault().rules.getOffset(time),
            weight = Mass.kilograms(kg),
        )
        hc.insertRecords(listOf(record))
    }

    // === Exercise type mapping ===

    private fun mapExerciseType(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "running"
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walking"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "cycling"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "swimming"
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "strength_training"
            ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "yoga"
            ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "pilates"
            ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hiking"
            ExerciseSessionRecord.EXERCISE_TYPE_ROWING -> "rowing"
            ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "elliptical"
            ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING -> "stair_climbing"
            ExerciseSessionRecord.EXERCISE_TYPE_DANCING -> "dance"
            ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS -> "martial_arts"
            ExerciseSessionRecord.EXERCISE_TYPE_TENNIS -> "tennis"
            ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL -> "basketball"
            ExerciseSessionRecord.EXERCISE_TYPE_SOCCER -> "football"
            ExerciseSessionRecord.EXERCISE_TYPE_GOLF -> "golf"
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "hiit"
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "functional_training"
            ExerciseSessionRecord.EXERCISE_TYPE_BOXING -> "boxing"
            ExerciseSessionRecord.EXERCISE_TYPE_CRICKET -> "cricket"
            ExerciseSessionRecord.EXERCISE_TYPE_SKIING_DOWNHILL -> "skiing"
            ExerciseSessionRecord.EXERCISE_TYPE_SNOWBOARDING -> "snowboarding"
            ExerciseSessionRecord.EXERCISE_TYPE_SURFING -> "surfing"
            ExerciseSessionRecord.EXERCISE_TYPE_ROCK_CLIMBING -> "climbing"
            else -> "other"
        }
    }
}
