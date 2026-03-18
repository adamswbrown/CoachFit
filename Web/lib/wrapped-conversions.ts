/**
 * Fun conversion utilities for Fitness Wrapped
 * Converts fitness metrics into relatable, shareable comparisons
 */

// Conversion constants
export const CONVERSIONS = {
  // Food
  BURGER_CALORIES: 500,
  PIZZA_CALORIES: 2000,
  DONUT_CALORIES: 250,

  // Distance
  MARATHON_DISTANCE_KM: 42.195,
  MOON_DISTANCE_KM: 384400,

  // Weight
  BASEBALL_WEIGHT_LBS: 0.32,
  BASKETBALL_WEIGHT_LBS: 1.38,

  // Time
  NETFLIX_EPISODE_MINS: 45,
  MOVIE_MINS: 120,
  SLEEP_FULL_DAY_HOURS: 24,

  // Units
  KM_TO_MILES: 0.621371,
  METERS_TO_KM: 0.001,
  AVG_STRIDE_METERS: 0.762, // Average walking stride
}

export interface CalorieConversion {
  burgers: number
  pizzas: number
  donuts: number
}

export interface DistanceConversion {
  marathons: number
  moonTrips: number
  miles: number
  kilometers: number
}

export interface WeightConversion {
  baseballs: number
  basketballs: number
}

export interface TimeConversion {
  days: number
  hours: number
}

export interface WorkoutTimeConversion {
  netflixEpisodes: number
  movies: number
  hours: number
}

/**
 * Convert calories to fun food comparisons
 */
export function convertCaloriesToFood(calories: number): CalorieConversion {
  return {
    burgers: Math.round(calories / CONVERSIONS.BURGER_CALORIES),
    pizzas: Math.round(calories / CONVERSIONS.PIZZA_CALORIES),
    donuts: Math.round(calories / CONVERSIONS.DONUT_CALORIES)
  }
}

/**
 * Convert steps to distance comparisons
 */
export function convertStepsToDistance(steps: number): DistanceConversion {
  const metersFromSteps = steps * CONVERSIONS.AVG_STRIDE_METERS
  const kmFromSteps = metersFromSteps * CONVERSIONS.METERS_TO_KM

  return {
    marathons: Math.round((kmFromSteps / CONVERSIONS.MARATHON_DISTANCE_KM) * 10) / 10,
    moonTrips: Math.round((kmFromSteps / CONVERSIONS.MOON_DISTANCE_KM) * 100000) / 100000,
    miles: Math.round(kmFromSteps * CONVERSIONS.KM_TO_MILES),
    kilometers: Math.round(kmFromSteps)
  }
}

/**
 * Convert weight to object comparisons
 */
export function convertWeightToObjects(weightLbs: number): WeightConversion {
  return {
    baseballs: Math.round(weightLbs / CONVERSIONS.BASEBALL_WEIGHT_LBS),
    basketballs: Math.round(weightLbs / CONVERSIONS.BASKETBALL_WEIGHT_LBS)
  }
}

/**
 * Convert sleep minutes to readable time format
 */
export function convertSleepToReadable(totalSleepMins: number): TimeConversion {
  const hours = totalSleepMins / 60

  return {
    days: Math.round((hours / CONVERSIONS.SLEEP_FULL_DAY_HOURS) * 10) / 10,
    hours: Math.round(hours)
  }
}

/**
 * Convert workout duration to activity comparisons
 */
export function convertWorkoutTimeToActivities(durationMins: number): WorkoutTimeConversion {
  return {
    netflixEpisodes: Math.round(durationMins / CONVERSIONS.NETFLIX_EPISODE_MINS),
    movies: Math.round(durationMins / CONVERSIONS.MOVIE_MINS),
    hours: Math.round(durationMins / 60)
  }
}

/**
 * Get a fun comparison string for calories
 */
export function getCalorieComparisonString(calories: number): string {
  const { burgers, pizzas, donuts } = convertCaloriesToFood(calories)

  if (burgers >= 5) {
    return `That's ${burgers} burgers! 🍔`
  } else if (pizzas >= 1) {
    return `That's ${pizzas} ${pizzas === 1 ? 'pizza' : 'pizzas'}! 🍕`
  } else {
    return `That's ${donuts} donuts! 🍩`
  }
}

/**
 * Get a fun comparison string for steps
 */
export function getStepsComparisonString(steps: number): string {
  const { marathons, miles, moonTrips } = convertStepsToDistance(steps)

  if (marathons >= 1) {
    return `That's ${marathons} ${marathons === 1 ? 'marathon' : 'marathons'}! 🏃`
  } else if (moonTrips > 0.00001) {
    return `That's ${(moonTrips * 100).toFixed(3)}% of the way to the moon! 🌙`
  } else {
    return `That's ${miles} miles! 👟`
  }
}

/**
 * Get a fun comparison string for weight change
 */
export function getWeightChangeComparisonString(weightLbs: number): string {
  const absWeight = Math.abs(weightLbs)
  const { baseballs, basketballs } = convertWeightToObjects(absWeight)
  const verb = weightLbs < 0 ? 'Lost' : 'Gained'

  if (basketballs >= 2) {
    return `${verb} the weight of ${basketballs} basketballs! 🏀`
  } else {
    return `${verb} the weight of ${baseballs} baseballs! ⚾`
  }
}

/**
 * Get a fun comparison string for sleep
 */
export function getSleepComparisonString(totalSleepMins: number): string {
  const { days, hours } = convertSleepToReadable(totalSleepMins)

  if (days >= 1) {
    return `That's ${days} full ${days === 1 ? 'day' : 'days'} of sleep! 😴`
  } else {
    return `That's ${hours} hours of rest! 💤`
  }
}

/**
 * Get a fun comparison string for workout time
 */
export function getWorkoutTimeComparisonString(durationMins: number): string {
  const { netflixEpisodes, movies, hours } = convertWorkoutTimeToActivities(durationMins)

  if (netflixEpisodes >= 2) {
    return `That's ${netflixEpisodes} Netflix episodes worth of workouts! 📺`
  } else if (movies >= 1) {
    return `That's ${movies} ${movies === 1 ? 'movie' : 'movies'} worth of workouts! 🎬`
  } else {
    return `That's ${hours} ${hours === 1 ? 'hour' : 'hours'} of sweat! 💪`
  }
}
