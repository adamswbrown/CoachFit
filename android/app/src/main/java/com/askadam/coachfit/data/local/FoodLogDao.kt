package com.askadam.coachfit.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface FoodLogDao {

    @Insert
    suspend fun insert(entry: FoodLogEntry): Long

    @Delete
    suspend fun delete(entry: FoodLogEntry)

    @Query("SELECT * FROM food_log WHERE date = :date ORDER BY loggedAt DESC")
    fun getEntriesForDate(date: String): Flow<List<FoodLogEntry>>

    @Query("SELECT * FROM food_log WHERE date = :date ORDER BY loggedAt DESC")
    suspend fun getEntriesForDateOnce(date: String): List<FoodLogEntry>

    @Query("SELECT * FROM food_log WHERE date BETWEEN :startDate AND :endDate ORDER BY date DESC, loggedAt DESC")
    fun getEntriesForDateRange(startDate: String, endDate: String): Flow<List<FoodLogEntry>>

    @Query("SELECT SUM(calories) FROM food_log WHERE date = :date")
    suspend fun getTotalCaloriesForDate(date: String): Double?

    @Query("DELETE FROM food_log WHERE id = :id")
    suspend fun deleteById(id: Long)
}
