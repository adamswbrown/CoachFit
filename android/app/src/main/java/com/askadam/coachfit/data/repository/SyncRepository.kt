package com.askadam.coachfit.data.repository

import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.data.remote.DailyStepsRecord
import com.askadam.coachfit.data.remote.ProfileMetric
import com.askadam.coachfit.data.remote.ProfilePayload
import com.askadam.coachfit.data.remote.SleepPayload
import com.askadam.coachfit.data.remote.StepsPayload
import com.askadam.coachfit.data.remote.WorkoutsPayload
import com.askadam.coachfit.health.HealthConnectManager
import com.askadam.coachfit.util.DateUtils
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

data class TypeSyncStatus(
    val lastSync: Instant? = null,
    val lastCount: Int = 0,
    val lastError: String? = null
)

@Singleton
class SyncRepository @Inject constructor(
    private val apiService: ApiService,
    private val authRepository: AuthRepository,
    private val healthConnectManager: HealthConnectManager,
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private const val TAG = "SyncRepository"
        private const val WORKOUT_CHUNK_SIZE = 100
        private const val SLEEP_STEP_CHUNK_SIZE = 400
        private const val WEIGHT_CHUNK_SIZE = 50
        private const val DEFAULT_LOOKBACK_DAYS = 30L

        private val KEY_LAST_SYNC_WORKOUTS = longPreferencesKey("lastSync.workouts")
        private val KEY_LAST_SYNC_SLEEP = longPreferencesKey("lastSync.sleep")
        private val KEY_LAST_SYNC_STEPS = longPreferencesKey("lastSync.steps")
        private val KEY_LAST_SYNC_WEIGHT = longPreferencesKey("lastSync.weight")
        private val KEY_LAST_SYNC_ANY = longPreferencesKey("lastSync.any")
    }

    private val _workoutStatus = MutableStateFlow(TypeSyncStatus())
    val workoutStatus: StateFlow<TypeSyncStatus> = _workoutStatus

    private val _sleepStatus = MutableStateFlow(TypeSyncStatus())
    val sleepStatus: StateFlow<TypeSyncStatus> = _sleepStatus

    private val _stepsStatus = MutableStateFlow(TypeSyncStatus())
    val stepsStatus: StateFlow<TypeSyncStatus> = _stepsStatus

    private val _weightStatus = MutableStateFlow(TypeSyncStatus())
    val weightStatus: StateFlow<TypeSyncStatus> = _weightStatus

    private val _lastSyncTime = MutableStateFlow<Instant?>(null)
    val lastSyncTime: StateFlow<Instant?> = _lastSyncTime

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing

    suspend fun syncAll() {
        val clientId = authRepository.getClientId() ?: return
        if (_isSyncing.value) return
        _isSyncing.value = true

        try {
            coroutineScope {
                val workoutJob = async { syncWorkouts(clientId) }
                val sleepJob = async { syncSleep(clientId) }
                val stepsJob = async { syncSteps(clientId) }
                val weightJob = async { syncWeight(clientId) }

                workoutJob.await()
                sleepJob.await()
                stepsJob.await()
                weightJob.await()
            }

            val now = Instant.now()
            _lastSyncTime.value = now
            dataStore.edit { prefs ->
                prefs[KEY_LAST_SYNC_ANY] = now.toEpochMilli()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed", e)
        } finally {
            _isSyncing.value = false
        }
    }

    suspend fun performInitialBackfill() {
        val lookback = DateUtils.daysAgo(DEFAULT_LOOKBACK_DAYS).toEpochMilli()
        dataStore.edit { prefs ->
            prefs[KEY_LAST_SYNC_WORKOUTS] = lookback
            prefs[KEY_LAST_SYNC_SLEEP] = lookback
            prefs[KEY_LAST_SYNC_STEPS] = lookback
            prefs[KEY_LAST_SYNC_WEIGHT] = lookback
        }
        syncAll()
    }

    private suspend fun getLastSync(key: Preferences.Key<Long>): Instant {
        val prefs = dataStore.data.first()
        val millis = prefs[key] ?: DateUtils.daysAgo(DEFAULT_LOOKBACK_DAYS).toEpochMilli()
        return Instant.ofEpochMilli(millis)
    }

    private suspend fun setLastSync(key: Preferences.Key<Long>, time: Instant) {
        dataStore.edit { prefs ->
            prefs[key] = time.toEpochMilli()
        }
    }

    private suspend fun syncWorkouts(clientId: String) {
        try {
            val since = getLastSync(KEY_LAST_SYNC_WORKOUTS)
            val workouts = healthConnectManager.fetchWorkouts(since)
            if (workouts.isEmpty()) return

            workouts.chunked(WORKOUT_CHUNK_SIZE).forEach { chunk ->
                apiService.submitWorkouts(WorkoutsPayload(clientId, chunk))
            }

            setLastSync(KEY_LAST_SYNC_WORKOUTS, Instant.now())
            _workoutStatus.value = TypeSyncStatus(
                lastSync = Instant.now(),
                lastCount = workouts.size
            )
        } catch (e: Exception) {
            Log.e(TAG, "Workout sync failed", e)
            _workoutStatus.value = _workoutStatus.value.copy(lastError = e.message)
        }
    }

    private suspend fun syncSleep(clientId: String) {
        try {
            val since = getLastSync(KEY_LAST_SYNC_SLEEP)
            val records = healthConnectManager.fetchSleepRecords(since)
            if (records.isEmpty()) return

            records.chunked(SLEEP_STEP_CHUNK_SIZE).forEach { chunk ->
                apiService.submitSleep(SleepPayload(clientId, chunk))
            }

            setLastSync(KEY_LAST_SYNC_SLEEP, Instant.now())
            _sleepStatus.value = TypeSyncStatus(
                lastSync = Instant.now(),
                lastCount = records.size
            )
        } catch (e: Exception) {
            Log.e(TAG, "Sleep sync failed", e)
            _sleepStatus.value = _sleepStatus.value.copy(lastError = e.message)
        }
    }

    private suspend fun syncSteps(clientId: String) {
        try {
            val since = getLastSync(KEY_LAST_SYNC_STEPS)
            val steps = healthConnectManager.fetchDailySteps(since)
            if (steps.isEmpty()) return

            val records = steps.map { (date, count) ->
                DailyStepsRecord(date = date, totalSteps = count)
            }

            records.chunked(SLEEP_STEP_CHUNK_SIZE).forEach { chunk ->
                apiService.submitSteps(StepsPayload(clientId, chunk))
            }

            setLastSync(KEY_LAST_SYNC_STEPS, Instant.now())
            _stepsStatus.value = TypeSyncStatus(
                lastSync = Instant.now(),
                lastCount = records.size
            )
        } catch (e: Exception) {
            Log.e(TAG, "Steps sync failed", e)
            _stepsStatus.value = _stepsStatus.value.copy(lastError = e.message)
        }
    }

    private suspend fun syncWeight(clientId: String) {
        try {
            val since = getLastSync(KEY_LAST_SYNC_WEIGHT)
            val weightRecords = healthConnectManager.fetchWeightRecords(since)
            val heightRecords = healthConnectManager.fetchHeightRecords(since)

            val metrics = mutableListOf<ProfileMetric>()

            weightRecords.forEach { (value, unit, time) ->
                metrics.add(ProfileMetric("weight", value, unit, DateUtils.toIsoString(time)))
            }
            heightRecords.forEach { (value, unit, time) ->
                metrics.add(ProfileMetric("height", value, unit, DateUtils.toIsoString(time)))
            }

            if (metrics.isEmpty()) return

            metrics.chunked(WEIGHT_CHUNK_SIZE).forEach { chunk ->
                apiService.submitProfile(ProfilePayload(clientId, chunk))
            }

            setLastSync(KEY_LAST_SYNC_WEIGHT, Instant.now())
            _weightStatus.value = TypeSyncStatus(
                lastSync = Instant.now(),
                lastCount = metrics.size
            )
        } catch (e: Exception) {
            Log.e(TAG, "Weight sync failed", e)
            _weightStatus.value = _weightStatus.value.copy(lastError = e.message)
        }
    }
}
