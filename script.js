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
    style: "data/style.json",
    renderWorldCopies: false,
    maxBoundsViscosity: 0.9
});

// PIXI.js
let sideLength = Math.min(window.innerWidth, window.innerHeight);
const pixi = new PIXI.Application({
    width: sideLength,
    height: sideLength,
    backgroundColor: 0xffffff,
    resolution: window.devicePixelRatio || 1,
    antialias: true,
});
document.getElementById('canvas-container').appendChild(pixi.view);

const gridGraphics = new PIXI.Graphics();
const scatterGraphics = new PIXI.Graphics();
const legendContainer = new PIXI.Container();
pixi.stage.addChild(gridGraphics, scatterGraphics, legendContainer);

const isMobile = window.innerWidth <= 768;
const padding = isMobile ? 50 : 70; // Відступи

const maxCoord = 1000;
let points = [];
let cachedVisibleIds = new Set();

fetch('data/odesa_buildings.geojson')
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
            const layers = map.getStyle().layers;
            let firstSymbolId;
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') {
                    firstSymbolId = layers[i].id;
                    break;
                }
            }

            map.addSource('buildings', {
                type: 'geojson',
                data,
            });

            map.addLayer(
                {
                    'id': 'buildings-layer',
                    'type': 'fill',
                    'source': 'buildings',
                    'layout': {},
                    'paint': {
                        'fill-color': '#C605FC',
                        'fill-opacity': 0.8
                    }
                },
                firstSymbolId
            );

            map.on('moveend', updateVisiblePoints);

            resizePixiCanvas();
        });
    });

function scale(value, min, max, rangeMin, rangeMax) {
    return rangeMin + ((value - min) / (max - min)) * (rangeMax - rangeMin);
}

function resizePixiCanvas() {
    sideLength = Math.min(window.innerWidth, window.innerHeight);
    pixi.renderer.resize(sideLength, sideLength);
    pixi.view.style.width = `${sideLength}px`;
    pixi.view.style.height = `${sideLength}px`;

    drawGraphic();
    updateScatterplot();
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

    gridGraphics.lineStyle(3, 0x8b8b8b, 0.7);
    gridGraphics.moveTo(centerX, padding).lineTo(centerX, sideLength - padding);
    gridGraphics.moveTo(padding, centerY).lineTo(sideLength - padding, centerY);

    const screenWidth = window.innerWidth;

    let fontSize;
    if (screenWidth >= 1200) {
        fontSize = 30;
    } else if (screenWidth >= 768) {
        fontSize = 26;
    } else if (screenWidth <= 768) {
        fontSize = 15;
    } else {
        fontSize = 15;
    }

    const textStyle = new PIXI.TextStyle({
        fontSize: fontSize,
        fill: 0x000000,
        align: 'center',
    });

    const xLegend = new PIXI.Text('Відстань до зупинки маршрутки, м', textStyle);
    xLegend.anchor.set(0.5);
    xLegend.position.set(sideLength / 2, sideLength - 15);
    legendContainer.addChild(xLegend);

    const yLegend = new PIXI.Text('Відстань до зупинки громадського транспорту, м', textStyle);
    yLegend.anchor.set(0.5);
    yLegend.position.set(7, sideLength / 2);
    yLegend.rotation = -Math.PI / 2;
    legendContainer.addChild(yLegend);

    const axisTextStyle = new PIXI.TextStyle({
        fontSize: fontSize * 0.9,
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

function getPointSize() {
    const screenWidth = window.innerWidth;
    return Math.max(1, Math.min(5, screenWidth / 200)); // мінімальний розмір, максимальний
}

let showGreyPoints = false;
const toggleGreyPoints = document.getElementById('toggle-grey-points');

toggleGreyPoints.addEventListener('change', (event) => {
    showGreyPoints = event.target.checked;
    updateScatterplot();
});

function updateScatterplot() {
    scatterGraphics.clear();

    if (!points.length) return;

    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const yMin = Math.min(...points.map(p => p.y));
    const yMax = Math.max(...points.map(p => p.y));

    const pointSize = getPointSize();

    points.forEach(point => {
        const x = scale(point.x, xMin, xMax, padding, sideLength - padding);
        const y = scale(point.y, yMin, yMax, padding, sideLength - padding);

        const isVisible = cachedVisibleIds.has(point.id);

        if (isVisible) {
            scatterGraphics.beginFill(0xe815fe, 0.2)
                .drawCircle(x, sideLength - y, pointSize)
                .endFill();
        } else if (!showGreyPoints) {
            scatterGraphics.beginFill(0x808080, 0.1)
                .drawCircle(x, sideLength - y, pointSize)
                .endFill();
        }
    });
}

function updateVisiblePoints() {
    if (!map.getLayer('buildings-layer')) {
        console.warn("Layer 'buildings-layer' не існує ще.");
        return;
    }

    const visibleFeatures = map.queryRenderedFeatures({ layers: ['buildings-layer'] });
    const newVisibleIds = new Set(visibleFeatures.map(f => f.properties.id));

    if (newVisibleIds.size !== cachedVisibleIds.size ||
        ![...newVisibleIds].every(id => cachedVisibleIds.has(id))) {
        cachedVisibleIds = newVisibleIds;
        updateScatterplot();
    }
}
function toggleOpacity(element) {
    element.classList.toggle('active');
  }

window.addEventListener('resize', resizePixiCanvas);
map.resize();
