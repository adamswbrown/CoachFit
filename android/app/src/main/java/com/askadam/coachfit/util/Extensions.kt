package com.askadam.coachfit.util

import kotlin.math.roundToInt

fun Double.roundTo(decimals: Int): Double {
    var multiplier = 1.0
    repeat(decimals) { multiplier *= 10 }
    return (this * multiplier).roundToInt() / multiplier
}

fun Double.kgToLbs(): Double = this * 2.20462

fun Double.lbsToKg(): Double = this / 2.20462

fun Double.metersToFeetInches(): Pair<Int, Int> {
    val totalInches = this * 39.3701
    val feet = (totalInches / 12).toInt()
    val inches = (totalInches % 12).roundToInt()
    return feet to inches
}

fun Int.formatWithCommas(): String {
    return String.format("%,d", this)
}

fun Double.formatCalories(): String {
    return if (this >= 1000) {
        String.format("%,.0f", this)
    } else {
        String.format("%.0f", this)
    }
}
