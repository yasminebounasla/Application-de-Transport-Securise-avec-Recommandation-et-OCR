const ALGERIA_BOUNDS = {
  minLat: 18.96,
  maxLat: 37.09,
  minLng: -8.67,
  maxLng: 11.98,
};

function isInAlgeria(location) {
  if (!location || !location.latitude || !location.longitude) {
    return false;
  }

  const { latitude, longitude } = location;

  return (
    latitude >= ALGERIA_BOUNDS.minLat &&
    latitude <= ALGERIA_BOUNDS.maxLat &&
    longitude >= ALGERIA_BOUNDS.minLng &&
    longitude <= ALGERIA_BOUNDS.maxLng
  );
}

export function validateAlgeriaLocations(req, res, next) {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({
      success: false,
      error: 'Start and end locations are required'
    });
  }

  const startInAlgeria = isInAlgeria(start);
  const endInAlgeria = isInAlgeria(end);

  if (!startInAlgeria || !endInAlgeria) {
    let message = '';
    
    if (!startInAlgeria && !endInAlgeria) {
      message = 'Le point de départ et la destination sont en dehors de l\'Algérie';
    } else if (!startInAlgeria) {
      message = 'Le point de départ est en dehors de l\'Algérie';
    } else {
      message = 'La destination est en dehors de l\'Algérie';
    }

    return res.status(400).json({
      success: false,
      error: message,
      code: 'LOCATION_OUT_OF_BOUNDS',
      details: {
        startValid: startInAlgeria,
        endValid: endInAlgeria,
      }
    });
  }

  next();
}

export { isInAlgeria };