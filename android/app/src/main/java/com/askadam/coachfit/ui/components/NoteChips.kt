package com.askadam.coachfit.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private val noteSuggestions = listOf(
    "Feeling great",
    "Low energy",
    "Sore muscles",
    "Good workout",
    "Rest day",
    "Ate well",
    "Ate poorly",
    "Stressed",
    "Slept well",
    "Slept badly",
    "Busy day",
    "Travel"
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NoteChips(
    selectedNotes: Set<String>,
    onNoteToggled: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        noteSuggestions.forEach { note ->
            FilterChip(
                selected = note in selectedNotes,
                onClick = { onNoteToggled(note) },
                label = { Text(note) }
            )
        }
    }
}
