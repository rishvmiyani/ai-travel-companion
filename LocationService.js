import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background Location Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const currentLocation = locations[0];
    
    console.log('Background Location Ping:', currentLocation.coords);

    // TODO: Phase 2 - Send coords to Context/Geofence Engine
    // e.g., const geofence = await checkGeofences(currentLocation.coords);
    // if (geofence) { triggerStory(geofence) }
  }
});

export const startBackgroundLocationTracking = async () => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.warn('Foreground location permission denied');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission denied');
      return false;
    }

    // Start receiving updates in the background
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000, // Ping every 15 seconds (Adaptive polling logic can be added later)
      distanceInterval: 50, // Or ping every 50 meters
      showsBackgroundLocationIndicator: true, // Required for iOS
      foregroundService: {
        notificationTitle: 'AI Travel Companion is active',
        notificationBody: 'Searching for nearby stories and points of interest...',
        notificationColor: '#BB86FC',
      },
    });

    console.log('Background location tracking started!');
    return true;
  } catch (err) {
    console.error('Failed to start background tracking', err);
    return false;
  }
};

export const stopBackgroundLocationTracking = async () => {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Background location tracking stopped!');
    }
  } catch (err) {
    console.error('Failed to stop background tracking', err);
  }
};
