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

    async getUnfilteredFlights(lat, lon) {
        const radius = 250; // Max radius en NM
        const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${radius}`;
        
        const data = await this.fetchProfessional(url, true, true);
        console.log(`📡 Area Scan [${lat.toFixed(2)}, ${lon.toFixed(2)}]: ${data?.ac ? data.ac.length : 0} Contacts.`);
        
        if (data && data.ac) {
            return data.ac.map(ac => ({
                hex: ac.hex,
                flight: ac.flight ? ac.flight.trim() : "UNC-ID",
                lon: ac.lon,
                lat: ac.lat,
                alt_baro: (ac.alt_baro || 0) * 0.3048,
                // On récupère le flag 'mil' pour différencier les cibles
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