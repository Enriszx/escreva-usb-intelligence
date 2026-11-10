package com.auraaudio.app.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "connection_events")
data class ConnectionEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val type: String,            // CONNECTED / DISCONNECTED
    val deviceName: String?,
    val address: String?,
    val batteryLevel: Int,       // -1 = desconhecido no momento
    val latitude: Double?,       // posição do TELEFONE no evento (opcional)
    val longitude: Double?
)

@Entity(tableName = "diagnostic_reports")
data class DiagnosticReportEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val summary: String,
    val json: String
)

@Dao
interface AuraDao {
    @Insert suspend fun insertEvent(e: ConnectionEventEntity)
    @Query("SELECT * FROM connection_events ORDER BY timestamp DESC LIMIT 100")
    fun events(): Flow<List<ConnectionEventEntity>>
    @Query("SELECT * FROM connection_events WHERE type='DISCONNECTED' AND latitude IS NOT NULL ORDER BY timestamp DESC LIMIT 1")
    suspend fun lastSeenWithLocation(): ConnectionEventEntity?
    @Query("DELETE FROM connection_events") suspend fun clearEvents()

    @Insert suspend fun insertReport(r: DiagnosticReportEntity)
    @Query("SELECT * FROM diagnostic_reports ORDER BY timestamp DESC LIMIT 20")
    fun reports(): Flow<List<DiagnosticReportEntity>>
    @Query("DELETE FROM diagnostic_reports WHERE id = :id") suspend fun deleteReport(id: Long)
}

@Database(entities = [ConnectionEventEntity::class, DiagnosticReportEntity::class], version = 1, exportSchema = false)
abstract class AuraDatabase : RoomDatabase() {
    abstract fun dao(): AuraDao

    companion object {
        @Volatile private var instance: AuraDatabase? = null
        fun get(context: Context): AuraDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, AuraDatabase::class.java, "aura.db")
                .fallbackToDestructiveMigration()
                .build().also { instance = it }
        }
    }
}
