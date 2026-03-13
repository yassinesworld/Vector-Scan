export const DataEngine = {
    async getUnfilteredFlights() {
        // Try the most stable proxy for GitHub Pages
        const url = "https://opendata.adsb.fi/api/v2/all";
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(proxy);
            const data = await response.json();
            const aircraft = JSON.parse(data.contents).aircraft;
            
            if (aircraft && aircraft.length > 0) return aircraft;
            throw new Error("Empty Data");
        } catch (e) {
            console.warn("🛰️ API Link Failed. Injecting Simulated SIGINT...");
            // Simulated aircraft over Europe/Baltic for testing
            return [
                { hex: "DF123", lat: 54.4, lon: 18.5, alt_baro: 35000, flight: "GHOST-1", mil: "1" },
                { hex: "DF456", lat: 55.2, lon: 21.0, alt_baro: 32000, flight: "NATO-SQ", mil: "1" },
                { hex: "CV789", lat: 52.5, lon: 13.4, alt_baro: 25000, flight: "LUFT-44", mil: "0" }
            ];
        }
    },

    async getSatelliteTLEs() {
        const url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json";
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(proxy);
            const data = await response.json();
            return JSON.parse(data.contents);
        } catch (e) {
            console.warn("📡 Orbital Data Lost. Using Backup TLE.");
            return [{
                OBJECT_NAME: "ISS (ZARYA)",
                TLE_LINE1: "1 25544U 98067A   24074.54963553  .00015501  00000-0  27929-3 0  9993",
                TLE_LINE2: "2 25544  51.6416 288.3845 0004511  70.7634  43.2505 15.49528571444155"
            }];
        }
    }
};