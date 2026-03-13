export const SHADER_MODES = {
    // FLIR: Thermal / High Contrast
    FLIR: {
        brightness: 1.5,
        contrast: 2.0,
        hue: 0.0,
        saturation: -1.0, // Monochromatic
        colorFilter: [1.0, 0.5, 0.0] // Amber/Heat glow
    },
    // NVG: Night Vision Green
    NVG: {
        brightness: 12.2,
        contrast: 1.8,
        hue: 0.3, // Green shift
        saturation: 0.5,
        noise: true // Add grain for "Analog" feel
    },
    // ANIME: Cel-shaded / Ghibli
    ANIME: {
        brightness: 1.0,
        contrast: 1.2,
        hue: 0.0,
        saturation: 1.5,
        edgeDetection: true // The black outlines
    }
};