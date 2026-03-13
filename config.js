export const CONFIG = {
    CESIUM_TOKEN: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwOTAzYzFhZS03ODI5LTQxMjQtYjg3OC1kZWVjYmE2OTQ5N2YiLCJpZCI6NDAzMjI1LCJpYXQiOjE3NzM0MjgxNzZ9.bnp5owax4jmM-TCpaKLyqtfPydH1D-c5G1UVFOWls-Q",
    
    ENDPOINTS: {
        // No 'url=' parameter, just the proxy followed by the target
        FLIGHTS: "https://corsproxy.io/?https://opendata.adsb.fi/api/v2/all",
        SATELLITES: "https://corsproxy.io/?https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json"
    },

    THEME: {
        glowColor: "#00ccff",
        dangerColor: "#ff0000",
        buildingColor: [0.1, 0.2, 0.5, 1.0] 
    },

    KEYS: {
        AIS_STREAM: "b0f34fc2d5e21ac8410cf352c3bde116c4fc0a80"
    }
};