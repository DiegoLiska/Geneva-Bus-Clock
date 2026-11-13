// Add <script src="./departures.js" defer></script> to index.html.
(() => {
  const stops = [
    {
      id: "8592867", // Genève, Motta
      routes: [
        { line: "5", destination: /thonex/, field: "thonex" },
        { line: "8", destination: /veyrier/, field: "veyrier" },
        { line: "11", destination: /eaux vives/, field: "eaux" }
      ]
    },
    {
      id: "8592921", // Genève, Vidollet
      routes: [
        { line: "5", destination: /aeroport/, field: "aeroport" }
      ]
    }
  ];
  const refreshInterval = 45_000;
  const maxAge = 120_000;

  function normalize(name) {
    return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ");
  }

  function parseTime(value) {
    // Turn the API's +0100 or +0200 offset into standard ISO format for Safari.
    return typeof value === "string"
      ? Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))
      : NaN;
  }

  function departureTime(trip) {
    const predicted = parseTime(trip.stop?.prognosis?.departure);
    if (Number.isFinite(predicted)) return predicted;

    const scheduled = trip.stop?.departureTimestamp;
    if (Number.isFinite(scheduled)) return scheduled * 1000;
    return parseTime(trip.stop?.departure);
  }

  function render() {
    const now = Date.now();
    for (const stop of stops) {
      const fresh = now - stop.updated <= maxAge;
      for (const route of stop.routes) {
        const upcoming = fresh ? route.times.filter(time => time >= now) : [];
        route.cells.forEach((cell, index) => {
          const time = upcoming[index];
          let label = "—";
          if (time !== undefined) {
            const seconds = (time - now) / 1000;
            label = seconds < 60 ? "<1 min" : Math.floor(seconds / 60) + " min";
          }
          if (cell.textContent !== label) cell.textContent = label;
          cell.title = stop.failed ? "Update unavailable" :
            time !== undefined ? "Departure at this stop" : "No departure available";
        });
      }
    }
  }

  async function refreshStop(stop) {
    if (stop.loading || Date.now() - stop.lastRequest < 30_000) return;
    stop.loading = true;
    stop.lastRequest = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const url = new URL("https://transport.opendata.ch/v1/stationboard");
      url.searchParams.set("id", stop.id);
      url.searchParams.set("limit", "50");
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (Number(data.station?.id) !== Number(stop.id) || !Array.isArray(data.stationboard) || data.errors?.length) {
        throw new Error("Invalid station board");
      }

      for (const route of stop.routes) {
        route.times = data.stationboard
          .filter(trip => String(trip.number) === route.line && route.destination.test(normalize(trip.to)))
          .map(departureTime)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
      }
      stop.updated = Date.now();
      stop.failed = false;
    } catch (error) {
      stop.failed = true;
      console.warn("Departure update failed for stop " + stop.id, error);
    } finally {
      clearTimeout(timeout);
      stop.loading = false;
      render();
    }
  }

  function refreshAll() {
    if (!document.hidden) stops.forEach(refreshStop);
  }

  for (const stop of stops) {
    stop.updated = 0;
    stop.lastRequest = 0;
    for (const route of stop.routes) {
      route.times = [];
      route.cells = [1, 2].map(index => document.getElementById("time-" + route.field + "-" + index));
    }
  }
  render();
  refreshAll();
  setInterval(render, 1000);
  setInterval(refreshAll, refreshInterval);
  document.addEventListener("visibilitychange", refreshAll);
  window.addEventListener("online", refreshAll);
})();
