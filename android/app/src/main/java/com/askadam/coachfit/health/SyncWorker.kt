package com.askadam.coachfit.health

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.askadam.coachfit.data.repository.AuthRepository
import com.askadam.coachfit.data.repository.SyncRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncRepository: SyncRepository,
    private val authRepository: AuthRepository
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "SyncWorker"
    }

    override suspend fun doWork(): Result {
        if (!authRepository.isSignedInSync()) {
            Log.d(TAG, "Not signed in, skipping sync")
            return Result.success()
        }

        return try {
            Log.d(TAG, "Starting periodic sync")
            syncRepository.syncAll()
            Log.d(TAG, "Periodic sync completed")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Periodic sync failed", e)
            Result.retry()
        }
    }
}
