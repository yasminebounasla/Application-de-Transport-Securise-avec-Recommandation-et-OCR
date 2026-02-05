export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || minutes < 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(minutes);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

export function formatDistance(kilometers, decimals = 2) {
  if (kilometers === null || kilometers === undefined || kilometers < 0) {
    return "0 km";
  }

  if (kilometers < 1) {
    const meters = Math.round(kilometers * 1000);
    return `${meters} m`;
  }

  return `${kilometers.toFixed(decimals)} km`;
}

export function formatRouteInfo(distanceKm, durationMin) {
  const distance = formatDistance(distanceKm);
  const duration = formatDuration(durationMin);

  return `${distance} • ${duration}`;
}