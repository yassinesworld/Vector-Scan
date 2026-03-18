export const DataEngine = {
    PROXY: 'https://small-firefly-9ea6.worldyassines.workers.dev?url=', 

    async fetchProfessional(targetUrl, proxy = true, isJson = true) {
        try {
            const finalUrl = proxy ? (this.PROXY + encodeURIComponent(targetUrl)) : targetUrl;
            const response = await fetch(finalUrl);

            if (response.status === 429) {
                console.error("🛑 RATE LIMIT REACHED. Skipping scan.");
                return null;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return isJson ? await response.json() : await response.text();
        } catch (e) { 
            console.error("📡 Signal Jammed:", e);
            return null; 
        }
    },

    async getUnfilteredFlights(lat = 50.0, lon = 15.0, radius = 250) {
        // The 'point' endpoint returns ALL aircraft (Civ + Mil) in the area
        const url = `https://api.airplanes.live{lat}/${lon}/${radius}`;
        const data = await this.fetchProfessional(url, true, true);
        
        console.log(`✈️ Radar: ${data?.ac ? data.ac.length : 0} Total Targets Detected.`);
        
        if (data && data.ac) {
            return data.ac.map(ac => ({
                hex: ac.hex,
                flight: ac.flight ? ac.flight.trim() : "N/A",
                lon: ac.lon,
                lat: ac.lat,
                alt_baro: (ac.alt_baro || 0) * 0.3048,
                // Check the 'mil' flag from the API
                isMilitary: ac.mil === 1 
            }));
        }
        return [];
    },

    async getSatelliteTLEs() {
        // PROXY ACTIVÉ ici pour éviter le ban IP 403
        const url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";
        const rawData = await this.fetchProfessional(url, false, false); 

        if (!rawData) return [];

        const lines = rawData.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const tles = [];
        for (let i = 0; i < lines.length; i += 3) {
            if (lines[i+2]) {
                tles.push({
                    OBJECT_NAME: lines[i],
                    TLE_LINE1: lines[i+1],
                    TLE_LINE2: lines[i+2]
                });
            }
        }
        console.log(`🛰️ Parsed ${tles.length} Satellites`);
        return tles;
    }
};