import { CONFIG } from './config.js';
import { DataEngine } from './DataEngine.js';

// --- 1. GLOBAL SCOPE: UI BUTTONS ---
window.setVisualMode = (mode) => {
    console.log("Visual Command:", mode);
    const stages = viewer.scene.postProcessStages;
    while (stages.length > 0) { stages.remove(stages.get(0)); }
    
    if (mode === 'NVG') stages.add(Cesium.PostProcessStageLibrary.createNightVisionStage());
    else if (mode === 'FLIR') stages.add(Cesium.PostProcessStageLibrary.createBlackAndWhiteStage());
};

// --- 2. ENGINE INITIALIZATION ---
Cesium.Ion.defaultAccessToken = CONFIG.CESIUM_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: await Cesium.createWorldTerrainAsync(),
    baseLayerPicker: false, animation: false, timeline: false, geocoder: false, shouldAnimate: true
});

let satellites = [];

// --- 3. DATA HANDLERS ---
async function syncFlights() {
    console.log("📡 Requesting Flight Data...");
    try {
        const aircraft = await DataEngine.getUnfilteredFlights();
        
        // --- ADD THIS LINE: Removes old planes so the map stays clean ---
        viewer.entities.values.filter(e => e.id.startsWith('PLANE_')).forEach(e => viewer.entities.remove(e));
        
        console.log(`✈️ API Check: Received ${aircraft ? aircraft.length : 0} aircraft.`); 
        aircraft.forEach(ac => {
            const id = `PLANE_${ac.hex}`;
            const pos = Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, (ac.alt_baro || 0) * 0.3048);
            
            let entity = viewer.entities.getById(id);
            if (entity) {
                entity.position = pos;
            } else {
                viewer.entities.add({
                    id: id,
                    name: ac.flight ? ac.flight.trim() : `HEX_${ac.hex}`,
                    position: pos,
                    point: { 
                        pixelSize: ac.mil === "1" ? 8 : 4, 
                        color: ac.mil === "1" ? Cesium.Color.RED : Cesium.Color.CYAN 
                    }
                });
            }
        });
    } catch (e) {
        console.error("❌ Flight Sync Error:", e);
    }
}

async function initSatellites() {
    console.log("🛰️ Requesting Satellite Data...");
    try {
        const tles = await DataEngine.getSatelliteTLEs();
        console.log(`🛰️ API Check: Received ${tles ? tles.length : 0} TLEs.`);
        
        // Take 150 to keep performance smooth
        satellites = tles.slice(0, 150).map(tle => {
            try {
                // FIXED: Passing the specific lines instead of the whole object
                const satrec = satellite.twoline2satrec(tle.TLE_LINE1, tle.TLE_LINE2);
                
                if (!satrec) return null;

                const entity = viewer.entities.add({
                    name: tle.OBJECT_NAME,
                    point: { 
                        pixelSize: 4, 
                        color: Cesium.Color.fromCssColorString('#00ffaa'),
                        outlineWidth: 1 
                    }
                });

                return { satrec, entity };
            } catch (err) {
                // Skips any malformed TLEs without crashing the whole loop
                return null; 
            }
        }).filter(s => s !== null);
        
        console.log(`✅ Successfully initialized ${satellites.length} satellites.`);
    } catch (e) {
        console.error("❌ Satellite Init Error:", e);
    }
}

function updateOrbits() {
    const now = new Date();
    satellites.forEach(s => {
        const posProp = satellite.propagate(s.satrec, now);
        const gmst = satellite.gstime(now);
        if (posProp.position) {
            const posGeo = satellite.eciToGeodetic(posProp.position, gmst);
            s.entity.position = Cesium.Cartesian3.fromDegrees(
                satellite.degreesLong(posGeo.longitude),
                satellite.degreesLat(posGeo.latitude),
                posGeo.height * 1000
            );
        }
    });
}

// --- 4. STARTUP & DEBUG PULSE ---
async function start() {
        // --- RENDER BUILDINGS ---
    try {
        const buildingsTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingsTileset);

        // Optional: Style them to match your VECTOR-SCAN theme
        buildingsTileset.style = new Cesium.Cesium3DTileStyle({
            color: {
                conditions: [
                    ['${feature["building"]}' === "hospital", "color('red')"],
                    ['true', "color('#1a2a2a', 0.8)"] // Dark tactical grey
                ]
            }
        });
    } catch (error) {
        console.error("Error loading buildings:", error);
    }
    // Imagery setup
    const layer = viewer.imageryLayers.get(0);
    layer.brightness = 0.5;
    layer.contrast = 1.3;

    // Load static markers
    viewer.entities.add({
        name: "DEBUG_CENTER",
        position: Cesium.Cartesian3.fromDegrees(19.5, 54.4),
        ellipse: { semiMinorAxis: 120000, semiMajorAxis: 120000, material: Cesium.Color.RED.withAlpha(0.2) }
    });

    // Fire data requests
    await initSatellites();
    await syncFlights();

    // Loops
    setInterval(syncFlights, 15000);
    viewer.scene.postUpdate.addEventListener(updateOrbits);

    // --- DIAGNOSTIC MONITOR ---
    setInterval(() => {
        console.log("--- 🛠️ SYSTEM MONITOR ---");
        console.log("Total Entities:", viewer.entities.values.length);
        console.log("Active Satellites:", satellites.length);
        console.log("Camera Height:", viewer.camera.positionCartographic.height.toFixed(0), "m");
    }, 5000);

    // Force fly-to for verification
    console.log("✈️ Moving camera to observation sector...");
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(15.0, 52.0, 5000000.0), // Focus on Europe
        duration: 2
    });
}

start();