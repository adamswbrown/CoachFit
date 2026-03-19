package com.askadam.coachfit.ui.screens.more

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.OpenInBrowser
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.askadam.coachfit.data.remote.Milestone
import com.askadam.coachfit.data.remote.NutritionPayload
import com.askadam.coachfit.data.remote.NutritionRow
import com.askadam.coachfit.data.repository.CronometerParseResult
import com.askadam.coachfit.ui.components.MilestoneCard
import com.askadam.coachfit.util.DateUtils
import kotlinx.coroutines.launch

@Composable
fun MoreScreen(
    onSignOut: () -> Unit,
    viewModel: MoreViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val isSyncing by viewModel.syncRepository.isSyncing.collectAsStateWithLifecycle()
    val lastSync by viewModel.syncRepository.lastSyncTime.collectAsStateWithLifecycle()
    val workoutStatus by viewModel.syncRepository.workoutStatus.collectAsStateWithLifecycle()
    val sleepStatus by viewModel.syncRepository.sleepStatus.collectAsStateWithLifecycle()
    val stepsStatus by viewModel.syncRepository.stepsStatus.collectAsStateWithLifecycle()
    val weightStatus by viewModel.syncRepository.weightStatus.collectAsStateWithLifecycle()

    var showUnpairDialog by remember { mutableStateOf(false) }
    var csvResult by remember { mutableStateOf<CronometerParseResult?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val csvPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri?.let {
            scope.launch {
                context.contentResolver.openInputStream(it)?.use { stream ->
                    csvResult = viewModel.parseCsv(stream)
                }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "More",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }

        // Coach info
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Coach", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        text = state.coachName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Milestones
        if (state.milestones.isNotEmpty()) {
            item {
                Text(
                    text = "Recent Milestones",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            items(state.milestones.take(3)) { milestone ->
                MilestoneCard(milestone = milestone)
            }
        }

        // Sync status
        item {
            Text(
                text = "Sync Status",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    lastSync?.let { time ->
                        Text(
                            text = "Last sync: ${DateUtils.formatRelativeTime(time)}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    SyncTypeRow("Steps", stepsStatus.lastSync, stepsStatus.lastCount, stepsStatus.lastError)
                    SyncTypeRow("Workouts", workoutStatus.lastSync, workoutStatus.lastCount, workoutStatus.lastError)
                    SyncTypeRow("Sleep", sleepStatus.lastSync, sleepStatus.lastCount, sleepStatus.lastError)
                    SyncTypeRow("Weight", weightStatus.lastSync, weightStatus.lastCount, weightStatus.lastError)

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = { viewModel.syncNow() },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSyncing
                    ) {
                        if (isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.CloudSync, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                        Text("  Sync Now", modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }
        }

        // CSV Import
        item {
            Text(
                text = "Import",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        item {
            Button(
                onClick = { csvPicker.launch(arrayOf("text/csv", "text/comma-separated-values", "*/*")) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Upload, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("  Import Cronometer CSV")
            }
        }

        csvResult?.let { result ->
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Parsed ${result.rows.size} rows from ${result.totalRowsInFile} total",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        result.warnings.forEach { warning ->
                            Text(
                                text = warning,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }

                        if (result.rows.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    viewModel.uploadCsvRows(result.rows)
                                    csvResult = null
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Upload ${result.rows.size} rows")
                            }
                        }
                    }
                }
            }
        }

        // Links
        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        }

        item {
            Button(
                onClick = {
                    val intent = CustomTabsIntent.Builder().build()
                    intent.launchUrl(context, Uri.parse("https://gcgyms.com/dashboard"))
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.OpenInBrowser, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("  View Dashboard")
            }
        }

        // Unpair
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = { showUnpairDialog = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Text("  Unpair Device")
            }
        }

        // Version
        item {
            Text(
                text = "CoachFit Android v1.0.0",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp)
            )
            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Unpair confirmation dialog
    if (showUnpairDialog) {
        AlertDialog(
            onDismissRequest = { showUnpairDialog = false },
            title = { Text("Unpair Device") },
            text = { Text("This will sign you out and remove all local data. Are you sure?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showUnpairDialog = false
                        viewModel.unpair(onSignOut)
                    }
                ) {
                    Text("Unpair", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnpairDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun SyncTypeRow(
    label: String,
    lastSync: java.time.Instant?,
    lastCount: Int,
    lastError: String?
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall)
        Text(
            text = when {
                lastError != null -> "Error"
                lastSync != null -> "$lastCount items • ${DateUtils.formatRelativeTime(lastSync)}"
                else -> "Not synced"
            },
            style = MaterialTheme.typography.bodySmall,
            color = if (lastError != null) MaterialTheme.colorScheme.error
            else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
