import { CONFIG } from './config.js';

export const DataEngine = {
    async fetchJson(targetUrl) {
        // AllOrigins is our best bet, but we need to handle it better
        const proxy = "https://api.allorigins.win/raw?url=";
        
        try {
            console.log(`📡 Fetching via Proxy: ${targetUrl.substring(0, 40)}...`);
            const response = await fetch(proxy + encodeURIComponent(targetUrl));
            
            if (!response.ok) return null;

            const data = await response.json();
            return data;
        } catch (e) {
            console.error("❌ Proxy fetch failed:", e);
            return null;
        }
    },

    async getUnfilteredFlights() {
        // Flights are usually small enough for the proxy
        const target = "https://opendata.adsb.fi/api/v2/all";
        const data = await this.fetchJson(target);
        return data?.aircraft || [];
    },

    async getSatelliteTLEs() {
        // REDUCED GROUP: 'visual' instead of 'active' 
        // This drops the payload from 5MB to 50KB so the proxy won't time out.
        const target = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json";
        const data = await this.fetchJson(target);
        return data || [];
    }
};