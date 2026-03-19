package com.askadam.coachfit.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {

    @POST("api/pair")
    suspend fun pair(@Body request: PairRequest): PairResponse

    @POST("api/client/register-device")
    suspend fun registerDevice(@Body request: RegisterDeviceRequest): RegisterDeviceResponse

    @POST("api/ingest/entry")
    suspend fun submitEntry(@Body entry: SubmitEntryRequest): Response<Any>

    @POST("api/ingest/workouts")
    suspend fun submitWorkouts(@Body payload: WorkoutsPayload): Response<Any>

    @POST("api/ingest/sleep")
    suspend fun submitSleep(@Body payload: SleepPayload): Response<Any>

    @POST("api/ingest/steps")
    suspend fun submitSteps(@Body payload: StepsPayload): Response<Any>

    @POST("api/ingest/profile")
    suspend fun submitProfile(@Body payload: ProfilePayload): Response<Any>

    @POST("api/ingest/cronometer")
    suspend fun submitNutrition(@Body payload: NutritionPayload): Response<Any>

    @GET("api/client/streak")
    suspend fun getStreak(): StreakResponse
}
