package com.askadam.coachfit.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object DateUtils {
    private val dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    private val isoFormatter = DateTimeFormatter.ISO_INSTANT

    fun today(): String = LocalDate.now().format(dateFormatter)

    fun formatDate(date: LocalDate): String = date.format(dateFormatter)

    fun parseDate(dateStr: String): LocalDate = LocalDate.parse(dateStr, dateFormatter)

    fun toIsoString(instant: Instant): String = isoFormatter.format(instant)

    fun toIsoString(millis: Long): String = toIsoString(Instant.ofEpochMilli(millis))

    fun startOfDay(date: LocalDate): Instant =
        date.atStartOfDay(ZoneId.systemDefault()).toInstant()

    fun endOfDay(date: LocalDate): Instant =
        date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant()

    fun daysAgo(days: Long): Instant =
        startOfDay(LocalDate.now().minusDays(days))

    fun epochMillis(): Long = System.currentTimeMillis()

    fun formatRelativeTime(instant: Instant): String {
        val now = Instant.now()
        val seconds = now.epochSecond - instant.epochSecond
        return when {
            seconds < 60 -> "Just now"
            seconds < 3600 -> "${seconds / 60}m ago"
            seconds < 86400 -> "${seconds / 3600}h ago"
            else -> "${seconds / 86400}d ago"
        }
    }
}
