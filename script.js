let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
    container: 'map',
    zoom: 11,
    minZoom: 11,
    maxZoom: 18.5,
    center: [30.70863, 46.43863],
    style: "style.json",
    renderWorldCopies: false,
});

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
                .filter(p => p.x !== null && p.y !== null && p.x <= 1000 && p.y <= 1000);
        });
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
    return rangeMin + ((value - min) / (max - min)) * (rangeMax - rangeMin);
}

let cachedVisibleIds = new Set();

function updateVisiblePoints() {
    const visibleFeatures = map.queryRenderedFeatures({ layers: ['buildings-layer'] });
    const newVisibleIds = new Set(visibleFeatures.map(f => f.properties.id));

    const newlyVisibleIds = [...newVisibleIds].filter(id => !cachedVisibleIds.has(id));
    const removedIds = [...cachedVisibleIds].filter(id => !newVisibleIds.has(id));

    if (newlyVisibleIds.length > 0 || removedIds.length > 0) {
        cachedVisibleIds = newVisibleIds;
        updateScatterplot();
    }
}

function updateScatterplot() {
    const scatterGraphics = app.stage.children[0] || new PIXI.Graphics();
    scatterGraphics.clear();

    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const yMin = Math.min(...points.map(p => p.y));
    const yMax = Math.max(...points.map(p => p.y));

    points.forEach(point => {
        if (point.x > 1000 || point.y > 1000) return;

        const x = scale(point.x, xMin, xMax, 50, sideLength - 50);
        const y = scale(point.y, yMin, yMax, 50, sideLength - 50);
        scatterGraphics.beginFill(0x808080, 0.1).drawCircle(x, sideLength - y, 7).endFill();
    });

    points.forEach(point => {
        if (!cachedVisibleIds.has(point.id) || point.x > 1000 || point.y > 1000) return;

        const x = scale(point.x, xMin, xMax, 50, sideLength - 50);
        const y = scale(point.y, yMin, yMax, 50, sideLength - 50);
        scatterGraphics.beginFill(0xe815fe, 0.2).drawCircle(x, sideLength - y, 7).endFill();
    });

    if (!app.stage.children.includes(scatterGraphics)) {
        app.stage.addChild(scatterGraphics);
    }
}

map.on('moveend', updateVisiblePoints);

window.addEventListener('resize', () => {
    const sideLength = Math.min(window.innerWidth, window.innerHeight);
    app.renderer.resize(sideLength, sideLength);
});
