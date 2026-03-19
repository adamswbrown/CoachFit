package com.askadam.coachfit.ui.navigation

import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.askadam.coachfit.ui.screens.food.FoodLogEntryScreen
import com.askadam.coachfit.ui.screens.food.FoodLogScreen
import com.askadam.coachfit.ui.screens.food.FoodSearchScreen
import com.askadam.coachfit.ui.screens.food.ProductScreen
import com.askadam.coachfit.ui.screens.food.ScannerScreen
import com.askadam.coachfit.ui.screens.health.HealthDashboardScreen
import com.askadam.coachfit.ui.screens.more.MoreScreen
import com.askadam.coachfit.ui.screens.onboarding.OnboardingFlow
import com.askadam.coachfit.ui.screens.signin.SignInScreen
import com.askadam.coachfit.ui.screens.today.TodayScreen

// Route constants
object Routes {
    const val SIGN_IN = "sign_in"
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val TODAY = "today"
    const val LOG_FOOD = "log_food"
    const val FOOD_LOG = "food_log"
    const val HEALTH = "health"
    const val MORE = "more"
    const val FOOD_SEARCH = "food_search/{searchType}"
    const val SCANNER = "scanner"
    const val PRODUCT = "product"
    const val PRODUCT_WITH_BARCODE = "product/{barcode}"

    fun foodSearch(type: String) = "food_search/$type"
    fun productWithBarcode(barcode: String) = "product/$barcode"
}

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Routes.TODAY, "Today", Icons.Default.Today),
    BottomNavItem(Routes.LOG_FOOD, "Log Food", Icons.Default.Add),
    BottomNavItem(Routes.FOOD_LOG, "Food", Icons.Default.Restaurant),
    BottomNavItem(Routes.HEALTH, "Health", Icons.Default.FitnessCenter),
    BottomNavItem(Routes.MORE, "More", Icons.Default.MoreHoriz),
)

@Composable
fun CoachFitNavHost(
    isSignedIn: Boolean,
    onboardingComplete: Boolean
) {
    val startDestination = when {
        !isSignedIn -> Routes.SIGN_IN
        !onboardingComplete -> Routes.ONBOARDING
        else -> Routes.HOME
    }

    val rootNavController = rememberNavController()

    NavHost(
        navController = rootNavController,
        startDestination = startDestination,
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None }
    ) {
        composable(Routes.SIGN_IN) {
            SignInScreen(
                onSignInSuccess = { needsOnboarding ->
                    val dest = if (needsOnboarding) Routes.ONBOARDING else Routes.HOME
                    rootNavController.navigate(dest) {
                        popUpTo(Routes.SIGN_IN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.ONBOARDING) {
            OnboardingFlow(
                onComplete = {
                    rootNavController.navigate(Routes.HOME) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                onSignOut = {
                    rootNavController.navigate(Routes.SIGN_IN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

@Composable
fun HomeScreen(
    onSignOut: () -> Unit
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Only show bottom nav on top-level tab destinations
    val showBottomBar = currentDestination?.route in bottomNavItems.map { it.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == item.route } == true,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.TODAY,
            modifier = Modifier.padding(innerPadding),
            enterTransition = { EnterTransition.None },
            exitTransition = { ExitTransition.None }
        ) {
            composable(Routes.TODAY) {
                TodayScreen()
            }
            composable(Routes.LOG_FOOD) {
                FoodLogEntryScreen(
                    onNavigateToScanner = {
                        navController.navigate(Routes.SCANNER)
                    },
                    onNavigateToSearch = { searchType ->
                        navController.navigate(Routes.foodSearch(searchType))
                    },
                    onNavigateToManualEntry = {
                        navController.navigate(Routes.PRODUCT)
                    }
                )
            }
            composable(Routes.FOOD_LOG) {
                FoodLogScreen()
            }
            composable(Routes.HEALTH) {
                HealthDashboardScreen()
            }
            composable(Routes.MORE) {
                MoreScreen(onSignOut = onSignOut)
            }
            composable(Routes.SCANNER) {
                ScannerScreen(
                    onBarcodeScanned = { barcode ->
                        navController.navigate(Routes.productWithBarcode(barcode)) {
                            popUpTo(Routes.SCANNER) { inclusive = true }
                        }
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Routes.FOOD_SEARCH) { backStackEntry ->
                val searchType = backStackEntry.arguments?.getString("searchType") ?: "products"
                FoodSearchScreen(
                    searchType = searchType,
                    onProductSelected = { barcode ->
                        navController.navigate(Routes.productWithBarcode(barcode))
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Routes.PRODUCT) {
                ProductScreen(
                    barcode = null,
                    onSaved = { navController.popBackStack() },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
            composable(Routes.PRODUCT_WITH_BARCODE) { backStackEntry ->
                val barcode = backStackEntry.arguments?.getString("barcode")
                ProductScreen(
                    barcode = barcode,
                    onSaved = {
                        navController.popBackStack(Routes.LOG_FOOD, inclusive = false)
                    },
                    onNavigateBack = { navController.popBackStack() }
                )
            }
        }
    }
}
