// Geneva, near Motta. Forecast data: Open-Meteo (https://open-meteo.com/), CC BY 4.0.
(() => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: "46.2194",
    longitude: "6.1347",
    current: "temperature_2m,apparent_temperature",
    hourly: "weather_code,is_day",
    forecast_days: "2",
    timeformat: "unixtime"
  });

  const temperature = document.getElementById("temperature");
  const feelsLike = document.getElementById("feels-like");
  const forecast = document.getElementById("forecast");
  const minute = 60000;
  let updated = 0;
  let lastAttempt = 0;
  let loading = false;

  const descriptions = {
    2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Snow showers",
    95: "Thunderstorms", 96: "Storms with hail", 99: "Storms with hail"
  };

  function condition(code, day) {
    if (code === 0) return day === 1 ? "Sunny" : "Clear";
    if (code === 1) return day === 1 ? "Mostly sunny" : "Mostly clear";
    return descriptions[code] || "—";
  }

  function degrees(value) {
    return Number.isFinite(value) ? Math.round(value) + " °C" : "— °C";
  }

  async function refresh() {
    if (document.hidden) return;
    const now = Date.now();
    if (now - updated >= 45 * minute) {
      temperature.textContent = feelsLike.textContent = "— °C";
      forecast.textContent = "—";
    }
    if (loading || now - updated < 15 * minute || now - lastAttempt < minute) return;
    loading = true;
    lastAttempt = now;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const { current, hourly } = await response.json();
      // Compare epoch seconds so midnight and daylight-saving changes are handled alike.
      const nextHour = Math.floor(now / 3600000) * 3600 + 3600;
      const i = hourly.time.indexOf(nextHour);
      if (!Number.isFinite(current.time) || Math.abs(now - current.time * 1000) >= 45 * minute || i < 0) {
        throw new Error("Weather data is out of date");
      }
      temperature.textContent = degrees(current.temperature_2m);
      feelsLike.textContent = degrees(current.apparent_temperature);
      forecast.textContent = condition(hourly.weather_code[i], hourly.is_day[i]);
      forecast.setAttribute("aria-label", "Forecast: " + forecast.textContent + ". Weather data by Open-Meteo.");
      updated = now;
    } catch (error) {
      console.warn("Weather update failed", error);
    } finally {
      clearTimeout(timer);
      loading = false;
    }
  }

  refresh();
  setInterval(refresh, minute);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", refresh);
})();
