package com.askadam.coachfit.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [FoodLogEntry::class],
    version = 1,
    exportSchema = false
)
abstract class CoachFitDatabase : RoomDatabase() {
    abstract fun foodLogDao(): FoodLogDao
}
