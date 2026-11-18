import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import {fetchCurrentGpsLocation} from './gps';

const LocationButton = () => {
  const [latLng, setLatLng] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchLocation = async () => {
    try {
      setIsFetching(true);

      const location = await fetchCurrentGpsLocation();

      const value = ${location.latitude}, ${location.longitude};
      setLatLng(value);

      console.log('GPS location:', {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyInMeters: location.accuracy,
      });
    } catch (error: any) {
      Alert.alert(
        'Location Error',
        error?.message || 'Unable to fetch location.',
      );
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleFetchLocation}
        disabled={isFetching}>
        {isFetching ? (
          <ActivityIndicator />
        ) : (
          <Text>Fetch GPS Location</Text>
        )}
      </TouchableOpacity>

      <Text>{latLng || 'Location not fetched'}</Text>
    </>
  );
};

export default LocationButton;