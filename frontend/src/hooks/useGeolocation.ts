import { useState, useCallback } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const err = 'Geolocation is not supported by your browser.';
        setError(err);
        reject(new Error(err));
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: parseFloat(position.coords.latitude.toFixed(6)),
            longitude: parseFloat(position.coords.longitude.toFixed(6)),
          };
          setCoordinates(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          let message = 'Failed to retrieve location.';
          if (err.code === err.PERMISSION_DENIED) {
            message = 'Location access was denied. Please allow location permissions in your browser.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'Location information is currently unavailable.';
          } else if (err.code === err.TIMEOUT) {
            message = 'Location request timed out.';
          }
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  return { coordinates, error, loading, getLocation };
}
