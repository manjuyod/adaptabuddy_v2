package com.adaptabuddy.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.AddCircle
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.adaptabuddy.mobile.auth.AuthGate
import com.adaptabuddy.mobile.auth.AuthViewModel
import com.adaptabuddy.mobile.data.api.ApiClient
import com.adaptabuddy.mobile.data.api.ApiResult
import com.adaptabuddy.mobile.data.api.DashboardApi
import com.adaptabuddy.mobile.data.models.DashboardResponse

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            AdaptaBuddyApp()
        }
    }
}

internal val topLevelDestinationLabels = listOf("Home", "Habits", "Add", "Workout", "Food")

private data class TopLevelDestination(
    val label: String,
    val icon: ImageVector,
    val summary: String,
)

private val topLevelDestinations = listOf(
    TopLevelDestination(
        label = "Home",
        icon = Icons.Outlined.Home,
        summary = "Dashboard shell for latest weight, calories, recommendations, and progress.",
    ),
    TopLevelDestination(
        label = "Habits",
        icon = Icons.Outlined.CheckCircle,
        summary = "Daily status markers for workouts, food logging, weigh-ins, and stat updates.",
    ),
    TopLevelDestination(
        label = "Add",
        icon = Icons.Outlined.AddCircle,
        summary = "Quick entry point for food, workout completion, body stats, and exercise stats.",
    ),
    TopLevelDestination(
        label = "Workout",
        icon = Icons.Outlined.FitnessCenter,
        summary = "Upcoming workout, active plan, recent completions, and muscle summaries.",
    ),
    TopLevelDestination(
        label = "Food",
        icon = Icons.Outlined.Restaurant,
        summary = "Today food entries, calories, macros, meal types, and filters.",
    ),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AdaptaBuddyApp(
    authViewModel: AuthViewModel = viewModel(),
) {
    val authState by authViewModel.uiState.collectAsStateWithLifecycle()

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            AuthGate(
                state = authState,
                onSignIn = authViewModel::signIn,
                loggedInContent = {
                AuthenticatedShell(authViewModel = authViewModel)
                },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AuthenticatedShell(authViewModel: AuthViewModel) {
    var selectedIndex by rememberSaveable { mutableStateOf(0) }
    val selectedDestination = topLevelDestinations[selectedIndex]

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "AdaptaBuddy") },
                actions = {
                    IconButton(onClick = authViewModel::signOut) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.Logout,
                            contentDescription = "Sign out",
                        )
                    }
                },
            )
        },
        bottomBar = {
            AdaptabuddyNavigationBar(
                selectedIndex = selectedIndex,
                onDestinationSelected = { selectedIndex = it },
            )
        },
    ) { innerPadding ->
        if (selectedDestination.label == "Home") {
            HomeDashboardContent(
                authViewModel = authViewModel,
                contentPadding = innerPadding,
            )
        } else {
            DestinationContent(
                destination = selectedDestination,
                contentPadding = innerPadding,
            )
        }
    }
}

@Composable
private fun AdaptabuddyNavigationBar(
    selectedIndex: Int,
    onDestinationSelected: (Int) -> Unit,
) {
    NavigationBar {
        topLevelDestinations.forEachIndexed { index, destination ->
            NavigationBarItem(
                selected = selectedIndex == index,
                onClick = { onDestinationSelected(index) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.label,
                    )
                },
                label = { Text(text = destination.label) },
            )
        }
    }
}

private sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Loaded(val dashboard: DashboardResponse) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}

@Composable
private fun HomeDashboardContent(
    authViewModel: AuthViewModel,
    contentPadding: PaddingValues,
) {
    val dashboardApi = remember(authViewModel) {
        DashboardApi(
            ApiClient(
                accessTokenProvider = authViewModel::currentAccessToken,
                refreshAccessTokenProvider = authViewModel::refreshAccessToken,
            ),
        )
    }
    var dashboardState by remember { mutableStateOf<DashboardUiState>(DashboardUiState.Loading) }

    fun loadDashboard() {
        dashboardState = DashboardUiState.Loading
    }

    LaunchedEffect(dashboardState) {
        if (dashboardState != DashboardUiState.Loading) return@LaunchedEffect
        when (val result = dashboardApi.dashboard()) {
            is ApiResult.Success -> dashboardState = DashboardUiState.Loaded(result.value)
            is ApiResult.Failure -> {
                if (result.requiresLogin) {
                    authViewModel.requireLogin(result.message)
                } else {
                    dashboardState = DashboardUiState.Error(result.message)
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Home",
            style = MaterialTheme.typography.headlineMedium,
        )

        when (val state = dashboardState) {
            DashboardUiState.Loading -> {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            is DashboardUiState.Error -> {
                Text(
                    text = state.message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyLarge,
                )
                Button(onClick = ::loadDashboard) {
                    Text("Retry")
                }
            }

            is DashboardUiState.Loaded -> DashboardCards(state.dashboard)
        }
    }
}

@Composable
private fun DashboardCards(dashboard: DashboardResponse) {
    DashboardCard(title = "Today") {
        MetricRow("Calories", dashboard.today.caloriesConsumed.toString())
        MetricRow("Protein", "${dashboard.today.proteinG} g")
        MetricRow("Carbs", "${dashboard.today.carbsG} g")
        MetricRow("Fat", "${dashboard.today.fatG} g")
    }
    DashboardCard(title = "Body") {
        MetricRow(
            label = "Latest weight",
            value = dashboard.body.latestWeight?.let { "${it} ${dashboard.body.weightUnit}" }
                ?: "Not logged",
        )
        MetricRow("Last updated", dashboard.body.lastUpdated ?: "Not logged")
    }
    DashboardCard(title = "Workout") {
        MetricRow("Next", dashboard.workout.nextWorkoutName ?: "Not scheduled")
        MetricRow("Recommendation", dashboard.workout.recommendation)
    }
    DashboardCard(title = "Habits") {
        MetricRow("Food logged", yesNo(dashboard.habits.foodLoggedToday))
        MetricRow("Workout done", yesNo(dashboard.habits.workoutCompletedToday))
        MetricRow("Stats stale", yesNo(dashboard.habits.statsStale))
    }
}

@Composable
private fun DashboardCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
            )
            content()
        }
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
        )
    }
}

private fun yesNo(value: Boolean): String = if (value) "Yes" else "No"

@Composable
private fun DestinationContent(
    destination: TopLevelDestination,
    contentPadding: PaddingValues,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = destination.label,
            style = MaterialTheme.typography.headlineMedium,
        )
        Text(
            text = destination.summary,
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}
