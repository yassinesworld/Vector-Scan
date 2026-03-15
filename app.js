import { CONFIG } from './config.js';
import { DataEngine } from './DataEngine.js';

// --- 1. GLOBAL SCOPE ---
let satellites = []; // Holds satellite entities for monitoring

// --- 2. ENGINE INITIALIZATION ---
Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: await Cesium.createWorldTerrainAsync(),
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    geocoder: false,
    shouldAnimate: true
});

// --- 3. WORLD STYLING ---
async function initWorldStyle() {
    try {
        const buildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildings);
        buildings.style = new Cesium.Cesium3DTileStyle({
            color: "color('#00ffaa', 0.5)",
            show: true
        });
    } catch (e) { console.warn("Building Engine Offline"); }

    const layer = viewer.imageryLayers.get(0);
    layer.brightness = 0.4;
    layer.contrast = 1.2;
}

// --- 4. FLIGHT SYNC ---
async function syncFlights() {
    console.log("📡 VECTOR-SCAN: Updating Airspace...");
    try {
        const aircraft = await DataEngine.getUnfilteredFlights();

        // Remove old planes
        viewer.entities.values
            .filter(e => e.id && e.id.startsWith('PLANE_'))
            .forEach(e => viewer.entities.remove(e));

        aircraft.forEach(ac => {
            const id = `PLANE_${ac.hex}`;
            let color = Cesium.Color.CYAN;
            let pixelSize = 6;

            if (ac.isMilitary) { color = Cesium.Color.RED; pixelSize = 10; }
            else if (ac.flight === "N/A") { color = Cesium.Color.YELLOW; pixelSize = 5; }

            viewer.entities.add({
                id: id,
                name: `${ac.isMilitary ? '[MIL] ' : ''}${ac.flight}`,
                position: Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, ac.alt_baro),
                point: { pixelSize, color, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
                label: {
                    text: ac.isMilitary ? `⚠ ${ac.flight}` : ac.flight,
                    font: '10px monospace',
                    fillColor: color,
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 300000)
                }
            });
        });
    } catch (e) { console.error("Airspace sync failed:", e); }
}

// --- 5. SATELLITE INIT ---
async function initSatellites() {
    console.log("🛰️ INITIALIZING ORBITAL SECTOR...");
    try {
        const tles = await DataEngine.getSatelliteTLEs();
        console.log(`Loud and clear.`)
        console.log(`🛰️ TLEs Retrieved: ${tles.length}`);
        const safeTles = tles || [];
        console.log(`🛰️ Valid TLEs: ${safeTles.length}`);

        // Limit satellites for rendering performance; optional: slice to nearest 1000–5000 for full 14k
        const MAX_RENDER = 1000;

        satellites = safeTles.slice(0, MAX_RENDER).map(tle => {
            if (!tle.TLE_LINE1 || !tle.TLE_LINE2) return null;

            try {
                const satrec = satellite.twoline2satrec(tle.TLE_LINE1, tle.TLE_LINE2);

                const entity = viewer.entities.add({
                    name: tle.OBJECT_NAME,
                    position: new Cesium.CallbackProperty((time) => {
                        const now = Cesium.JulianDate.toDate(time);
                        const posProp = satellite.propagate(satrec, now);

                        if (!posProp || !posProp.position) return Cesium.Cartesian3.ZERO;

                        const gmst = satellite.gstime(now);
                        const posGeo = satellite.eciToGeodetic(posProp.position, gmst);

                        if (isNaN(posGeo.latitude) || isNaN(posGeo.longitude) || isNaN(posGeo.height)) {
                            return Cesium.Cartesian3.ZERO;
                        }

                        return Cesium.Cartesian3.fromDegrees(
                            satellite.degreesLong(posGeo.longitude),
                            satellite.degreesLat(posGeo.latitude),
                            posGeo.height * 1000
                        );
                    }, false),
                    point: {
                        pixelSize: 4,
                        color: Cesium.Color.fromCssColorString('#00ffaa'),
                        outlineWidth: 1
                    }
                });

                return { entity };
            } catch { return null; }
        }).filter(s => s !== null);

        console.log(`✅ ${satellites.length} Satellites Locked.`);
    } catch (e) { console.error("Sat Engine Error:", e); }
}

// --- 6. STARTUP SEQUENCE ---
async function start() {
    await initWorldStyle();

    // Load satellites and flights
    await initSatellites();
    await syncFlights();

    // Refresh loops
    setInterval(syncFlights, 15000); // planes every 15s

    setInterval(() => {
        const planes = viewer.entities.values.filter(e => e.id && e.id.startsWith('PLANE_')).length;
        console.log(`--- VECTOR-SCAN SITREP ---`);
        console.log(`ORBITAL_OBJECTS: ${satellites.length}`);
        console.log(`AIR_TARGETS: ${planes}`);
        console.log(`GRID_COORD: ${viewer.camera.positionCartographic.longitude.toFixed(4)}, ${viewer.camera.positionCartographic.latitude.toFixed(4)}`);
    }, 5000);

    // Initial camera fly-to
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(15.0, 50.0, 4000000.0),
        duration: 2
    });
}

// --- 7. LAUNCH ---
start();