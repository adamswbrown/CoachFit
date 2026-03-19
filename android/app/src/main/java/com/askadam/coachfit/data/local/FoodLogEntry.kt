package com.askadam.coachfit.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "food_log")
data class FoodLogEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val date: String,           // YYYY-MM-DD
    val barcode: String?,
    val name: String,
    val brand: String?,
    val servingGrams: Double,
    val calories: Double,
    val protein: Double,
    val fat: Double,
    val carbs: Double,
    val sugar: Double?,
    val fiber: Double?,
    val sodium: Double?,
    val loggedAt: Long           // epoch millis
)
