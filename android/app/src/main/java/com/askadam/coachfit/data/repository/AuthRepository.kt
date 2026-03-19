package com.askadam.coachfit.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val dataStore: DataStore<Preferences>
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "coachfit_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_CLIENT_ID = "client_id"
        private const val KEY_CLIENT_NAME = "client_name"
        private const val KEY_COACH_NAME = "coach_name"
        private val PREF_ONBOARDING_COMPLETE = booleanPreferencesKey("onboarding_complete")
    }

    // Reactive flows
    val isSignedIn: Flow<Boolean> = dataStore.data.map {
        getDeviceToken() != null
    }

    val onboardingComplete: Flow<Boolean> = dataStore.data.map { prefs ->
        prefs[PREF_ONBOARDING_COMPLETE] == true
    }

    // Synchronous checks
    fun isSignedInSync(): Boolean = getDeviceToken() != null

    fun isOnboardingCompleteSync(): Boolean {
        // Read from encrypted prefs for sync access
        return encryptedPrefs.getBoolean("onboarding_complete_sync", false)
    }

    // Credential management
    fun saveCredentials(
        deviceToken: String,
        clientId: String,
        clientName: String?,
        coachName: String?
    ) {
        encryptedPrefs.edit().apply {
            putString(KEY_DEVICE_TOKEN, deviceToken)
            putString(KEY_CLIENT_ID, clientId)
            clientName?.let { putString(KEY_CLIENT_NAME, it) }
            coachName?.let { putString(KEY_COACH_NAME, it) }
            apply()
        }
    }

    fun getDeviceToken(): String? = encryptedPrefs.getString(KEY_DEVICE_TOKEN, null)

    fun getClientId(): String? = encryptedPrefs.getString(KEY_CLIENT_ID, null)

    fun getClientName(): String? = encryptedPrefs.getString(KEY_CLIENT_NAME, null)

    fun getCoachName(): String? = encryptedPrefs.getString(KEY_COACH_NAME, null)

    suspend fun setOnboardingComplete(complete: Boolean) {
        dataStore.edit { prefs ->
            prefs[PREF_ONBOARDING_COMPLETE] = complete
        }
        // Also store sync copy
        encryptedPrefs.edit().putBoolean("onboarding_complete_sync", complete).apply()
    }

    fun clearCredentials() {
        encryptedPrefs.edit().clear().apply()
    }

    suspend fun signOut() {
        clearCredentials()
        dataStore.edit { prefs ->
            prefs.clear()
        }
    }
}
