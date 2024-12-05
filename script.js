let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
    container: 'map',
    zoom: 12,
    minZoom: 10.5,
    maxZoom: 18.5,
    center: [30.70863, 46.43863],
    style: "style.json",
    attributionControl: false,
    renderWorldCopies: false,
});

let width = window.innerWidth;
let height = window.innerHeight;

const sideLength = Math.min(width, height);

const app = new PIXI.Application({
    width: sideLength,
    height: sideLength,
    backgroundColor: 0xffffff,
    resolution: window.devicePixelRatio || 1,
});

document.getElementById('canvas-container').appendChild(app.view);

function scale(value, min, max, rangeMin, rangeMax) {
    const scaleX = (value - min) / (max - min); // Normalize to [0, 1]
    return rangeMin + scaleX * (rangeMax - rangeMin); // Map to the range
}

let cachedVisibleIds = new Set();

function drawScatterplot(visibleFeatures) {
    const visibleIds = new Set(visibleFeatures.map(f => f.properties.id));
    cachedVisibleIds = visibleIds;

    app.stage.removeChildren();

    const maxAllowedValue = 1000;
    const filteredPoints = points.filter(point => point.x <= maxAllowedValue && point.y <= maxAllowedValue);

    const xMin = Math.min(...filteredPoints.map(p => p.x));
    const xMax = Math.max(...filteredPoints.map(p => p.x));
    const yMin = Math.min(...filteredPoints.map(p => p.y));
    const yMax = Math.max(...filteredPoints.map(p => p.y));

    const scatterGraphics = new PIXI.Graphics();
    scatterGraphics.clear();

    filteredPoints.forEach(point => {
        const isVisible = visibleIds.has(point.id);
        const color = isVisible ? 0xe815fe : 0x808080;
        const opacity = isVisible ? 0.2 : 0.1;

        // Масштабуємо x та y в межах канвасу
        const x = scale(point.x, xMin, xMax, 50, sideLength - 50);
        const y = scale(point.y, yMin, yMax, 50, sideLength - 50);

        scatterGraphics.beginFill(color, opacity);
        scatterGraphics.drawCircle(x, sideLength - y, 7); // Віднімаємо y, щоб 0 був унизу
        scatterGraphics.endFill();
    });

    app.stage.addChild(scatterGraphics);
}

function updateVisiblePoints() {
    requestAnimationFrame(() => {
        const visibleFeatures = map.queryRenderedFeatures({ layers: ['buildings-layer'] });
        drawScatterplot(visibleFeatures);
    });
}

map.on('moveend', updateVisiblePoints);

fetch('odesa_buildings.geojson')
    .then(response => response.json())
    .then(data => {
        map.on('load', () => {
            map.addSource('buildings', {
                type: 'geojson',
                data: data,
            });

            map.addLayer({
                id: 'buildings-layer',
                type: 'fill',
                source: 'buildings',
                paint: {
                    'fill-color': 'white',
                    'fill-opacity': 0.5,
                },
            });

            points = data.features
                .map(f => ({
                    x: f.properties.nearest_shuttle_stop_dst,
                    y: f.properties.nearest_public_transport_stop_dst,
                    id: f.properties.id,
                }))
                .filter(point => point.x !== null && point.y !== null);

            updateVisiblePoints();
        });
    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
    });

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;

    const sideLength = Math.min(width, height);  // Maintain 1:1 aspect ratio
    app.renderer.resize(sideLength, sideLength);
    updateVisiblePoints();
});
