let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
    container: 'map',
    zoom: 11,
    minZoom: 11,
    maxZoom: 18.5,
    center: [30.70863, 46.43863],
    maxBounds: [
        [30.6030, 46.3408],
        [30.8403, 46.6334]
    ],
    style: "style.json",
    renderWorldCopies: false,
});

const sideLength = Math.min(window.innerWidth, window.innerHeight);
const app = new PIXI.Application({
    width: sideLength,
    height: sideLength,
    backgroundColor: 0xffffff,
    resolution: window.devicePixelRatio || 1,
});
document.getElementById('canvas-container').appendChild(app.view);

const gridGraphics = new PIXI.Graphics();
const scatterGraphics = new PIXI.Graphics();
const legendContainer = new PIXI.Container();
app.stage.addChild(gridGraphics, scatterGraphics, legendContainer);

const padding = 50;
const maxCoord = 1000;
let points = [];
let cachedVisibleIds = new Set();

//
const ignoredWords = ['вулиця', 'проспект', 'шосе', 'площа', 'бульвар', 'вул.', 'провулок'];
function normalizeAddress(address) {
    return address
        .split(' ')
        .map(word => word.toLowerCase())
        .filter(word => !ignoredWords.includes(word))
        .join(' ')
        .trim();
}

document.getElementById('search-button').addEventListener('click', () => {
    const input = document.getElementById('address-input').value.trim();
    const warning = document.getElementById('distance-warning');
    warning.textContent = '';

    const [inputStreet, inputHouse] = input.split(',').map(s => s.trim());
    if (!inputStreet || !inputHouse) {
        warning.textContent = 'Формат адреси має бути: "вулиця, номер будинку".';
        return;
    }

    const normalizedInputStreet = normalizeAddress(inputStreet);

    const targetPoint = points.find(p => 
        normalizeAddress(p.street) === normalizedInputStreet && 
        p.housenumber === inputHouse.trim()
    );

    if (targetPoint) {
        cachedVisibleIds = new Set([targetPoint.id]);
        updateScatterplot();
        map.setCenter([targetPoint.x, targetPoint.y]);
    } else {
        warning.textContent = 'Адресу не знайдено.';
    }
});

fetch('./data/odesa_buildings.geojson')
    .then(response => response.json())
    .then(data => {
        points = data.features
            .filter(f => f.properties.nearest_shuttle_stop_dst <= maxCoord &&
                         f.properties.nearest_public_transport_stop_dst <= maxCoord)
            .map(f => ({
                x: f.properties.nearest_shuttle_stop_dst,
                y: f.properties.nearest_public_transport_stop_dst,
                id: f.properties.id,
                street: f.properties['addr:street'],
                housenumber: f.properties['addr:housenumber'],
            }));

        map.on('load', () => {
            map.addSource('buildings', {
                type: 'geojson',
                data,
            });

            map.addLayer({
                id: 'buildings-layer',
                type: 'fill',
                source: 'buildings',
                paint: {
                    'fill-color': '#C605FC',
                    'fill-opacity': 0.8,
                },
            });

            updateScatterplot();
        });
    });

function scale(value, min, max, rangeMin, rangeMax) {
    return rangeMin + ((value - min) / (max - min)) * (rangeMax - rangeMin);
}

function drawGraphic() {
    gridGraphics.clear();
    legendContainer.removeChildren();

    const gridStep = 125;
    const labelStep = 250;

    gridGraphics.lineStyle(1, 0x000000, 0.2);

    for (let value = 0; value <= maxCoord; value += gridStep) {
        const pos = scale(value, 0, maxCoord, padding, sideLength - padding);

        gridGraphics.moveTo(pos, padding).lineTo(pos, sideLength - padding);
        gridGraphics.moveTo(padding, pos).lineTo(sideLength - padding, pos);
    }

    const centerX = padding + (sideLength - 2 * padding) / 2;
    const centerY = padding + (sideLength - 2 * padding) / 2;

    gridGraphics.lineStyle(4, 0x8b8b8b, 0.7);
    gridGraphics.moveTo(centerX, padding).lineTo(centerX, sideLength - padding);
    gridGraphics.moveTo(padding, centerY).lineTo(sideLength - padding, centerY);

    const textStyle = new PIXI.TextStyle({
        fontSize: 20,
        fill: 0x000000,
        align: 'center',
    });

    const xLegend = new PIXI.Text('Відстань до зупинки маршрутки, м', textStyle);
    xLegend.anchor.set(0.5);
    xLegend.position.set(sideLength / 2, sideLength - 15);
    legendContainer.addChild(xLegend);

    const yLegend = new PIXI.Text('Відстань до зупинки громадського транспорту, м', textStyle);
    yLegend.anchor.set(0.5);
    yLegend.position.set(15, sideLength / 2);
    yLegend.rotation = -Math.PI / 2;
    legendContainer.addChild(yLegend);

    const axisTextStyle = new PIXI.TextStyle({
        fontSize: 16,
        fill: 0x000000,
    });

    for (let value = 0; value <= maxCoord; value += labelStep) {
        const x = scale(value, 0, maxCoord, padding, sideLength - padding);
        const y = scale(value, 0, maxCoord, padding, sideLength - padding);

        const xLabel = new PIXI.Text(value.toString(), axisTextStyle);
        xLabel.anchor.set(0.5);
        xLabel.position.set(x, sideLength - padding + 10);
        legendContainer.addChild(xLabel);

        const yLabel = new PIXI.Text(value.toString(), axisTextStyle);
        yLabel.anchor.set(0.5);
        yLabel.position.set(padding - 10, sideLength - y);
        legendContainer.addChild(yLabel);
    }
}

drawGraphic();

function updateScatterplot() {
    scatterGraphics.clear();

    if (!points.length) return;

    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const yMin = Math.min(...points.map(p => p.y));
    const yMax = Math.max(...points.map(p => p.y));

    points.forEach(point => {
        const x = scale(point.x, xMin, xMax, padding, sideLength - padding);
        const y = scale(point.y, yMin, yMax, padding, sideLength - padding);

        const color = cachedVisibleIds.has(point.id) ? 0xe815fe : 0x808080;
        const alpha = cachedVisibleIds.has(point.id) ? 0.2 : 0.1;

        scatterGraphics.beginFill(color, alpha).drawCircle(x, sideLength - y, 7).endFill();
    });
}

function updateVisiblePoints() {
    const visibleFeatures = map.queryRenderedFeatures({ layers: ['buildings-layer'] });
    const newVisibleIds = new Set(visibleFeatures.map(f => f.properties.id));

    if (newVisibleIds.size !== cachedVisibleIds.size ||
        ![...newVisibleIds].every(id => cachedVisibleIds.has(id))) {
        cachedVisibleIds = newVisibleIds;
        updateScatterplot();
    }
}

map.on('moveend', updateVisiblePoints);
