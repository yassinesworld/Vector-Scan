export const DataEngine = {
    // REPLACE 'temp_xxxxxxxx' with your actual key from cors.sh
    API_KEY: 'temp_YOUR_FREE_KEY', 

    async fetchProfessional(targetUrl) {
        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'x-cors-gratis': 'true', // This is their "free tier" flag
                    // 'x-cors-api-key': this.API_KEY // Use this if you get a real key
                }
            });
            return await response.json();
        } catch (e) {
            console.error("Signal Lost. Falling back to simulation.");
            return null;
        }
    },

    async getUnfilteredFlights() {
        // We prepending the cors.sh proxy URL
        const url = "https://proxy.cors.sh/https://opendata.adsb.fi/api/v2/all";
        const data = await this.fetchProfessional(url);
        
        if (data && data.aircraft) return data.aircraft;
        
        // Simulation Fallback (Keep this so the map never goes empty)
        return [
            { hex: "DF123", lat: 54.4, lon: 18.5, alt_baro: 35000, flight: "GHOST-1", mil: "1" },
            { hex: "DF456", lat: 55.2, lon: 21.0, alt_baro: 32000, flight: "NATO-SQ", mil: "1" }
        ];
    },

    async getSatelliteTLEs() {
        const url = "https://proxy.cors.sh/https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json";
        const data = await this.fetchProfessional(url);
        return data || [{
            OBJECT_NAME: "ISS (ZARYA)",
            TLE_LINE1: "1 25544U 98067A   24074.54963553  .00015501  00000-0  27929-3 0  9993",
            TLE_LINE2: "2 25544  51.6416 288.3845 0004511  70.7634  43.2505 15.49528571444155"
        }];
    }
};