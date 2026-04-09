package com.lifecare.phonecompanion.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Memory
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.lifecare.phonecompanion.CompanionUiState
import com.lifecare.phonecompanion.data.PhoneLocation
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun CompanionScreen(
  uiState: CompanionUiState,
  onPatientIdChange: (String) -> Unit,
  onDeviceIdChange: (String) -> Unit,
  onGrantLocationPermission: () -> Unit,
  onRefreshGpsPreview: () -> Unit,
  onSimulateHardwareFall: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxSize(),
    color = Color(0xFFF4F7FB),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      item { HeroCard(uiState) }
      item {
        ConfigCard(
          uiState = uiState,
          onPatientIdChange = onPatientIdChange,
          onDeviceIdChange = onDeviceIdChange,
        )
      }
      item {
        GpsCard(
          uiState = uiState,
          onGrantLocationPermission = onGrantLocationPermission,
          onRefreshGpsPreview = onRefreshGpsPreview,
        )
      }
      item {
        HardwareBridgeCard(
          uiState = uiState,
          onSimulateHardwareFall = onSimulateHardwareFall,
        )
      }
      item { LastSyncCard(uiState) }
    }
  }
}

@Composable
private fun HeroCard(uiState: CompanionUiState) {
  Card(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 20.dp, vertical = 20.dp),
    shape = RoundedCornerShape(30.dp),
    colors = CardDefaults.cardColors(containerColor = Color.White),
  ) {
    Column(
      modifier = Modifier.padding(22.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        IconBubble(
          icon = Icons.Rounded.NotificationsActive,
          tint = Color(0xFFDC2626),
          background = Color(0xFFFEE2E2),
        )
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(
            text = "LifeCare Phone Companion",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
          )
          Text(
            text = "Phone captures GPS and writes the full fall row into Supabase. Website only reads and shows the map.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF475569),
          )
        }
      }

      AssistChip(
        onClick = { },
        label = {
          Text(
            if (uiState.permissionGranted) "GPS permission granted" else "GPS permission needed"
          )
        },
      )

      StatusBlock(title = uiState.statusTitle, body = uiState.statusMessage)

      uiState.lastError?.let { error ->
        Surface(
          shape = RoundedCornerShape(18.dp),
          color = Color(0xFFFEE2E2),
        ) {
          Text(
            text = error,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            color = Color(0xFFB91C1C),
            style = MaterialTheme.typography.bodyMedium,
          )
        }
      }
    }
  }
}

@Composable
private fun ConfigCard(
  uiState: CompanionUiState,
  onPatientIdChange: (String) -> Unit,
  onDeviceIdChange: (String) -> Unit,
) {
  InfoCard(
    title = "Linked Patient And Device",
    body = "Ye values wahi row me jayengi jo phone app Supabase me insert karega jab connected hardware fall signal bheje.",
    icon = Icons.Rounded.Memory,
    accent = Color(0xFF2563EB),
  ) {
    OutlinedTextField(
      value = uiState.patientId,
      onValueChange = onPatientIdChange,
      modifier = Modifier.fillMaxWidth(),
      label = { Text("Patient ID") },
      shape = RoundedCornerShape(20.dp),
      singleLine = true,
    )
    OutlinedTextField(
      value = uiState.deviceId,
      onValueChange = onDeviceIdChange,
      modifier = Modifier.fillMaxWidth(),
      label = { Text("Hardware Device ID") },
      shape = RoundedCornerShape(20.dp),
      singleLine = true,
    )
  }
}

@Composable
private fun GpsCard(
  uiState: CompanionUiState,
  onGrantLocationPermission: () -> Unit,
  onRefreshGpsPreview: () -> Unit,
) {
  InfoCard(
    title = "Phone GPS",
    body = "App directly phone ki location legi, isliye website ko browser location open rakhne ki zarurat nahi padegi.",
    icon = Icons.Rounded.LocationOn,
    accent = Color(0xFF059669),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Button(onClick = onGrantLocationPermission) {
        Text(if (uiState.permissionGranted) "Permission Ready" else "Grant Location")
      }
      FilledTonalButton(onClick = onRefreshGpsPreview) {
        Text("Refresh GPS Preview")
      }
    }

    Surface(
      shape = RoundedCornerShape(18.dp),
      color = Color(0xFFF8FAFC),
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Text(
          text = if (uiState.lastPreviewLocation == null) "No GPS fix yet" else "Current phone location",
          style = MaterialTheme.typography.titleMedium,
          fontWeight = FontWeight.SemiBold,
        )
        Text(
          text = formatLocation(uiState.lastPreviewLocation),
          style = MaterialTheme.typography.bodyMedium,
          color = Color(0xFF475569),
        )
      }
    }
  }
}

@Composable
private fun HardwareBridgeCard(
  uiState: CompanionUiState,
  onSimulateHardwareFall: () -> Unit,
) {
  InfoCard(
    title = "Hardware Trigger Bridge",
    body = "Actual BLE, Wi-Fi, ya USB service later isi bridge ko call karegi. Abhi manual test button se same flow verify ho jayega.",
    icon = Icons.Rounded.Sync,
    accent = Color(0xFF7C3AED),
  ) {
    Surface(
      shape = RoundedCornerShape(18.dp),
      color = Color(0xFF111827),
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Text(
          text = "Integration hook",
          style = MaterialTheme.typography.labelLarge,
          color = Color.White.copy(alpha = 0.85f),
        )
        Text(
          text = "HardwareSignalRouter.dispatch(HardwareFallSignal(patientId, deviceId, accelerationG))",
          style = MaterialTheme.typography.bodyMedium,
          color = Color.White,
        )
      }
    }

    Button(
      onClick = onSimulateHardwareFall,
      enabled = !uiState.isSyncing,
      modifier = Modifier.fillMaxWidth(),
    ) {
      Text(if (uiState.isSyncing) "Syncing Fall..." else "Simulate Connected Hardware Fall")
    }

    uiState.lastSignalDeviceId?.let { deviceId ->
      Text(
        text = "Last received hardware signal: $deviceId",
        style = MaterialTheme.typography.bodyMedium,
        color = Color(0xFF475569),
      )
    }
  }
}

@Composable
private fun LastSyncCard(uiState: CompanionUiState) {
  InfoCard(
    title = "Last Supabase Sync",
    body = "Jab connected hardware fall bhejega, app ek hi insert me fall + phone GPS dono save karegi.",
    icon = Icons.Rounded.CheckCircle,
    accent = Color(0xFFEA580C),
  ) {
    val rows = listOf(
      "Last synced at" to formatTime(uiState.lastSyncedAtMs),
      "Synced location" to formatLocation(uiState.lastSyncedLocation),
      "Response body" to (uiState.lastResponseBody?.take(180) ?: "No Supabase insert yet"),
    )

    rows.forEachIndexed { index, entry ->
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
          text = entry.first,
          style = MaterialTheme.typography.labelLarge,
          color = Color(0xFF64748B),
        )
        Text(
          text = entry.second,
          style = MaterialTheme.typography.bodyMedium,
          color = Color(0xFF0F172A),
        )
      }
      if (index != rows.lastIndex) {
        Divider(color = Color(0xFFE2E8F0))
      }
    }
  }
}

@Composable
private fun InfoCard(
  title: String,
  body: String,
  icon: ImageVector,
  accent: Color,
  content: @Composable Column.() -> Unit,
) {
  Card(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 20.dp),
    shape = RoundedCornerShape(30.dp),
    colors = CardDefaults.cardColors(containerColor = Color.White),
  ) {
    Column(
      modifier = Modifier.padding(22.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        IconBubble(icon = icon, tint = accent, background = accent.copy(alpha = 0.12f))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
          )
          Text(
            text = body,
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF475569),
          )
        }
      }
      content()
    }
  }
}

@Composable
private fun StatusBlock(title: String, body: String) {
  Surface(
    shape = RoundedCornerShape(22.dp),
    color = Color(0xFFEEF6FF),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
      )
      Text(
        text = body,
        style = MaterialTheme.typography.bodyMedium,
        color = Color(0xFF334155),
      )
    }
  }
}

@Composable
private fun IconBubble(
  icon: ImageVector,
  tint: Color,
  background: Color,
) {
  Surface(
    shape = CircleShape,
    color = background,
    modifier = Modifier.size(52.dp),
  ) {
    Row(
      modifier = Modifier.fillMaxSize(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = tint,
      )
    }
  }
}

private fun formatLocation(location: PhoneLocation?): String {
  if (location == null) return "No phone GPS captured yet"
  val accuracyText = location.accuracyMeters?.let { ", accuracy ${"%.1f".format(it)}m" } ?: ""
  return "${"%.6f".format(location.latitude)}, ${"%.6f".format(location.longitude)}$accuracyText"
}

private fun formatTime(timestampMs: Long?): String {
  if (timestampMs == null) return "No sync yet"
  return SimpleDateFormat("dd MMM yyyy, hh:mm:ss a", Locale.US).format(Date(timestampMs))
}
