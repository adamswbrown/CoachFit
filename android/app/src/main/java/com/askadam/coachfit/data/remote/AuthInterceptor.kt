package com.askadam.coachfit.data.remote

import com.askadam.coachfit.data.repository.AuthRepository
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val authRepository: AuthRepository
) : Interceptor {

    var onUnauthorized: (() -> Unit)? = null

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        val token = authRepository.getDeviceToken()
        val request = if (token != null) {
            originalRequest.newBuilder()
                .header("X-Pairing-Token", token)
                .build()
        } else {
            originalRequest
        }

        val response = chain.proceed(request)

        if (response.code == 401) {
            onUnauthorized?.invoke()
        }

        return response
    }
}
