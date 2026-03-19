package com.askadam.coachfit.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.data.remote.SubmitEntryRequest
import com.askadam.coachfit.util.DateUtils
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CheckInRepository @Inject constructor(
    private val apiService: ApiService,
    private val authRepository: AuthRepository,
    private val dataStore: DataStore<Preferences>
) {
    private fun checkinKey(date: String) = booleanPreferencesKey("checkin_$date")

    suspend fun isCheckedInToday(): Boolean {
        val today = DateUtils.today()
        val prefs = dataStore.data.first()
        return prefs[checkinKey(today)] == true
    }

    suspend fun submitEntry(
        date: String,
        weightLbs: Double?,
        steps: Int?,
        calories: Int?,
        sleepQuality: Int?,
        perceivedStress: Int?,
        notes: String?
    ): Result<Unit> {
        val clientId = authRepository.getClientId() ?: return Result.failure(
            IllegalStateException("Not signed in")
        )

        return try {
            val request = SubmitEntryRequest(
                clientId = clientId,
                date = date,
                weightLbs = weightLbs,
                steps = steps,
                calories = calories,
                sleepQuality = sleepQuality,
                perceivedStress = perceivedStress,
                notes = notes
            )
            val response = apiService.submitEntry(request)
            if (response.isSuccessful) {
                markCheckedIn(date)
                Result.success(Unit)
            } else {
                Result.failure(Exception("Server error: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun markCheckedIn(date: String) {
        dataStore.edit { prefs ->
            prefs[checkinKey(date)] = true
        }
    }

    suspend fun clearCheckedIn(date: String) {
        dataStore.edit { prefs ->
            prefs.remove(checkinKey(date))
        }
    }
}
