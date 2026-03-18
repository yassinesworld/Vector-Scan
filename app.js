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
// --- GLOBAL FLIGHT SCAN ---
const STEP_KM = 350;
const BATCH_SIZE = 5;
const SCAN_INTERVAL = 1000;
const MAX_RADIUS = 250;

let gridPoints = [];
let scanIndex = 0;

// ==========================
// BUILD GLOBAL GRID
// ==========================
function buildGrid() {
    gridPoints = [];

    const LAT_STEP = STEP_KM / 111;

    for (let lat = -80; lat <= 80; lat += LAT_STEP) {
        const cosLat = Math.cos(lat * Math.PI / 180);
        if (cosLat < 0.2) continue;

        const lonStep = STEP_KM / (111 * cosLat);

        for (let lon = -180; lon <= 180; lon += lonStep) {
            gridPoints.push({ lat, lon });
        }
    }

    console.log("🌍 Grid initialized:", gridPoints.length);
}

// ==========================
// PROCESS AIRCRAFT
// ==========================
function processAircraft(aircraft) {
    const serverTime = Cesium.JulianDate.now();

    aircraft.forEach(ac => {
        if (!ac.lon || !ac.lat || isNaN(ac.lon) || isNaN(ac.lat)) return;

        const id = `PLANE_${ac.hex}`;
        const alt = (isNaN(ac.alt_baro) || ac.alt_baro === null) ? 50 : ac.alt_baro + 50;
        const position = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, alt);

        let entity = viewer.entities.getById(id);

        const targetColor = ac.isMilitary 
            ? Cesium.Color.fromCssColorString(CONFIG.THEME.dangerColor)
            : Cesium.Color.fromCssColorString(CONFIG.THEME.glowColor);

        if (!entity) {
            const sampledPosition = new Cesium.SampledPositionProperty();
            sampledPosition.addSample(serverTime, position);

            entity = viewer.entities.add({
                id: id,
                position: sampledPosition,
                point: { 
                    pixelSize: ac.isMilitary ? 8 : 5,
                    color: targetColor,
                    outlineWidth: 1 
                },
                path: { 
                    show: true,
                    leadTime: 0,
                    trailTime: 300,
                    width: 1.2,
                    material: new Cesium.PolylineGlowMaterialProperty({ 
                        glowPower: 0.1,
                        color: targetColor 
                    })
                },
                label: {
                    text: ac.flight || "",
                    font: '10px monospace',
                    fillColor: targetColor,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    pixelOffset: new Cesium.Cartesian2(0, -15),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000)
                }
            });
        } else {
            entity.position.addSample(serverTime, position);
            entity.point.color = targetColor;
        }

        entity._lastSeen = Date.now();
    });
}

// ==========================
// CLEANUP
// ==========================
function cleanupPlanes() {
    const now = Date.now();

    viewer.entities.values
        .filter(e => e.id?.startsWith('PLANE_'))
        .forEach(e => {
            if (now - (e._lastSeen || 0) > 60000) {
                viewer.entities.remove(e);
            }
        });
}

// ==========================
// GLOBAL SCAN LOOP
// ==========================
async function globalScanStep() {
    for (let i = 0; i < BATCH_SIZE; i++) {
        if (scanIndex >= gridPoints.length) {
            scanIndex = 0;
            console.log("🌍 Full sweep completed, restarting...");
        }

        const { lat, lon } = gridPoints[scanIndex++];

        try {
            const aircraft = await DataEngine.getUnfilteredFlights(lat, lon, MAX_RADIUS);

            if (aircraft && Array.isArray(aircraft)) {
                processAircraft(aircraft);
            }
        } catch (e) {
            console.warn("Scan error at", lat, lon);
        }
    }

    cleanupPlanes();
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
                    point: { pixelSize: 4, color: Cesium.Color.fromCssColorString('#00ffaa'), outlineWidth: 1 }
                });
                return { entity };
            } catch { return null; }
        }).filter(s => s !== null);
    } catch (e) { console.error(e); }
}

async function start() {
    await initWorldStyle();
    await initSatellites();
    await syncFlights();
    setInterval(syncFlights, 15000);
    setInterval(() => {
        const planes = viewer.entities.values.filter(e => e.id?.startsWith('PLANE_')).length;
        console.log(`--- VECTOR-SCAN SITREP: Sats: ${satellites.length} | Planes: ${planes} ---`);
    }, 5000);
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(15.0, 50.0, 4000000.0), duration: 2 });
}

start();