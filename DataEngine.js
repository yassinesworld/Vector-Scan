export const DataEngine = {
    // TON PROXY PRIVÉ
    PROXY: 'https://small-firefly-9ea6.worldyassines.workers.dev?url=', 

    async fetchProfessional(targetUrl) {
        try {
            // On concatène proprement l'URL du worker et la cible
            const finalUrl = this.PROXY + encodeURIComponent(targetUrl);
            
            const response = await fetch(finalUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 429) console.error("⚠️ WORKER RATE LIMITED - Attends 60s.");
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (e) { 
            console.error("📡 Signal Jammed via Worker:", e);
            return null; 
        }
    },

    async getUnfilteredFlights() {
        // Airplanes.live snapshot (très complet)
        const url = "https://api.airplanes.live/v2/";
        const data = await this.fetchProfessional(url);
        
        if (data && data.ac) {
            console.log(`✈️ Radar: ${data.ac.length} targets via Worker.`);
            return data.ac.slice(0, 800000).map(ac => ({
                hex: ac.hex,
                flight: ac.flight ? ac.flight.trim() : "N/A",
                lon: ac.lon,
                lat: ac.lat,
                alt_baro: (ac.alt_baro || 0) * 0.3048,
                // Classification tactique
                isMilitary: ac.mil === "1" || /NATO|FOR|MIL|BAF|RCH/.test(ac.flight || ""),
                isUnknown: !ac.flight || ac.flight.trim() === ""
            }));
        }
        return [];
    },

    async getSatelliteTLEs() {

        const url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json";

        try {

            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                console.log(`🛰️ Orbit: Tracking ${data.length} satellites.`);
                console.log(`🛰️ Sample TLE: ${data[0]?.TLE_LINE1 || "N/A"}`);
                return data;
            }

            return [];

        } catch (e) {
            console.error("🛰️ Orbit feed lost:", e);
            return [];
        }
    }
};