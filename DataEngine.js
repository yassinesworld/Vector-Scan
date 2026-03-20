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

    async getUnfilteredFlights() {
        const adsbUrl = "https://opendata.adsb.fi/api/v2/mil";
        const openSkyUrl = "https://opensky-network.org/api/states/all";

        try {
            const [adsbData, openData] = await Promise.all([
                this.fetchProfessional(adsbUrl, true, true),
                this.fetchProfessional(openSkyUrl, true, true)
            ]);

            const fleet = new Map();

            // 1. Process Global ADS-B (High detail/Military)
            if (adsbData?.ac) {
                adsbData.ac.forEach(ac => {
                    if (!ac.lon || !ac.lat) return;
                    fleet.set(ac.hex.toLowerCase(), {
                        hex: ac.hex.toLowerCase(),
                        flight: ac.flight?.trim() || "ID-UNK",
                        lon: ac.lon, lat: ac.lat,
                        alt_baro: (ac.alt_baro || 0) * 0.3048,
                        isMilitary: ac.mil === 1 || ac.mil === "1"
                    });
                });
            }

            // 2. Merge Global OpenSky (Fill massive gaps in civilian coverage)
            if (openData?.states) {
                openData.states.forEach(s => {
                    const icao = s[0].toLowerCase();
                    if (!fleet.has(icao) && s[5] && s[6]) { // Ensure lat/lon exists
                        fleet.set(icao, {
                            hex: icao,
                            flight: s[1]?.trim() || "CIV-ID",
                            lon: s[5], lat: s[6],
                            alt_baro: s[7] || 0,
                            isMilitary: false
                        });
                    }
                });
            }

            const result = Array.from(fleet.values());
            console.log(`📡 GLOBAL STRATEGIC SCAN: ${result.length} Live Targets.`);
            return result;
        } catch (e) {
            console.error("Global Fetch Failed", e);
            return [];
        }
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