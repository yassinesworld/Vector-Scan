import { CONFIG } from './config.js';
import { DataEngine } from './DataEngine.js';

let satellites = []; 

// --- ENGINE INITIALIZATION ---
Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: await Cesium.createWorldTerrainAsync(),
    baseLayerPicker: false,
    animation: true,
    timeline: true,
    geocoder: false,
    shouldAnimate: true
});

// HUD STYLING
const toolbar = document.querySelector('.cesium-viewer-toolbar');
if (toolbar) toolbar.style.right = '40px'; 
viewer._cesiumWidget._creditContainer.style.display = 'none';

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
    layer.brightness = 0.4; layer.contrast = 1.2;
}

// --- FLIGHT SYNC ---
async function syncFlights() {
    const CACHE_KEY = "vs_flights_cache";
    const CACHE_TTL = 15000;

    try {
        let aircraft;
        const cached = localStorage.getItem(CACHE_KEY);
        const lastFetch = localStorage.getItem(CACHE_KEY + "_time");

        if (cached && (Date.now() - lastFetch < CACHE_TTL)) {
            aircraft = JSON.parse(cached);
        } else {
            // No parameters needed anymore - fetching the whole world
            aircraft = await DataEngine.getUnfilteredFlights();
            if (aircraft) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(aircraft));
                localStorage.setItem(CACHE_KEY + "_time", Date.now());
            }
        }

        if (!aircraft || !Array.isArray(aircraft)) return;

        const serverTime = Cesium.JulianDate.now();

        aircraft.forEach(ac => {
            const id = `PLANE_${ac.hex}`;
            const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, ac.alt_baro + 50);

            let entity = viewer.entities.getById(id);
            const targetColor = ac.isMilitary 
                ? Cesium.Color.fromCssColorString(CONFIG.THEME.dangerColor)
                : Cesium.Color.fromCssColorString(CONFIG.THEME.glowColor);

            if (!entity) {
                const sampledPos = new Cesium.SampledPositionProperty();
                sampledPos.addSample(serverTime, position);

                entity = viewer.entities.add({
                    id: id,
                    position: sampledPos,
                    point: { 
                        pixelSize: ac.isMilitary ? 7 : 4, 
                        color: targetColor, 
                        outlineWidth: 1,
                        // Keeps points visible through Earth for that "Deep Radar" look
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                    },
                    path: { 
                        show: true, trailTime: 600, width: 1.2,
                        material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.1, color: targetColor })
                    },
                    label: {
                        text: ac.flight, font: '10px monospace', fillColor: targetColor,
                        outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
                        pixelOffset: new Cesium.Cartesian2(0, -15),
                        // Only show labels when zoomed in to avoid a mess
                        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1500000)
                    }
                });
            } else {
                entity.position.addSample(serverTime, position);
                entity.point.color = targetColor;
            }
            entity._lastSeen = Date.now();
        });

        viewer.zoomTo(viewer.entities.values.find(e => e.id.startsWith('PLANE_')));

        // Global Cleanup: Wipe planes that haven't updated in 2 minutes
        const now = Date.now();
        viewer.entities.values.forEach(e => {
            if (e.id?.startsWith('PLANE_') && (now - (e._lastSeen || 0) > 120000)) {
                viewer.entities.remove(e);
            }
        });

    } catch (e) { console.error("Global Sync Error", e); }
}

// --- SATELLITE INIT ---
async function initSatellites() {
    const CACHE_KEY = "vs_sat_cache";
    const CACHE_TTL = 2 * 60 * 60 * 1000;
    try {
        let tles;
        const cached = localStorage.getItem(CACHE_KEY);
        const lastFetch = localStorage.getItem(CACHE_KEY + "_time");

        if (cached && (Date.now() - lastFetch < CACHE_TTL)) {
            tles = JSON.parse(cached);
        } else {
            tles = await DataEngine.getSatelliteTLEs();
            if (tles) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(tles));
                localStorage.setItem(CACHE_KEY + "_time", Date.now());
            }
        }

        satellites = (tles || []).slice(0, 1000).map(tle => {
            try {
                const satrec = satellite.twoline2satrec(tle.TLE_LINE1, tle.TLE_LINE2);
                const entity = viewer.entities.add({
                    name: tle.OBJECT_NAME,
                    position: new Cesium.CallbackProperty((time, result) => {
                        const now = Cesium.JulianDate.toDate(time);
                        const posProp = satellite.propagate(satrec, now);
                        if (!posProp || !posProp.position || isNaN(posProp.position.x)) return undefined;
                        const gmst = satellite.gstime(now);
                        const posGeo = satellite.eciToGeodetic(posProp.position, gmst);
                        if (isNaN(posGeo.latitude)) return undefined;
                        return Cesium.Cartesian3.fromDegrees(
                            satellite.degreesLong(posGeo.longitude),
                            satellite.degreesLat(posGeo.latitude),
                            posGeo.height * 1000, Cesium.Ellipsoid.WGS84, result
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
    } catch (e) { console.error(e); }
}

async function start() {
    console.log("🚀 Starting Vector-Scan...");
    console.log("Shoutout to The OpenSky Network, https://opensky-network.org for enabling this project");
    await initWorldStyle();
    await initSatellites();
    await syncFlights();
    setInterval(syncFlights, 15000);
    setInterval(() => {
        const planes = viewer.entities.values.filter(e => e.id?.startsWith('PLANE_')).length;
        console.log(`--- VECTOR-SCAN SITREP: Sats: ${satellites.length} | Planes: ${planes} ---`);
    }, 5000);
}

start();