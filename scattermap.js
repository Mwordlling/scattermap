fetch('odesa_buildings.geojson') // Завантажуємо файл з даними
  .then((response) => response.json())
  .then((data) => {

    const scatterMap = L.map('map').setView([46.4825, 30.7233], 13); // Виставляємо початкові координати та зум
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(scatterMap);

    const pointLayers = {};

    // Налаштування графіка
    const container = document.querySelector('#chart-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = containerHeight - margin.top - margin.bottom;

    const svg = d3.select('#chart').attr('width', containerWidth).attr('height', containerHeight).append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 1000]).range([0, chartWidth]);
    const yScale = d3.scaleLinear().domain([0, 1000]).range([chartHeight, 0]);

    const xTicks = d3.range(0, 1001, 250);
    const yTicks = d3.range(0, 1001, 250);

    const xGridLines = d3.range(0, 1001, 125);
    const yGridLines = d3.range(0, 1001, 125);

    svg.append('g')
    .attr('transform', `translate(0, ${chartHeight})`)
    .call(d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickSize(0)
    )
    .selectAll('.tick text')
    .style('fill', 'gray')
    .style('font-size', '12px');

    svg.append('g')
    .call(d3.axisLeft(yScale)
        .tickValues(yTicks)
        .tickSize(0)
    )
    .selectAll('.tick text')
    .style('fill', 'gray')
    .style('font-size', '12px');

    svg.append('g')
    .selectAll('.x-grid')
    .data(xGridLines)
    .enter()
    .append('line')
    .attr('class', 'x-grid')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', chartHeight)
    .style('stroke', 'gray')
    .style('stroke-opacity', 0.1)
    .style('stroke-width', 1);

    svg.append('g')
    .selectAll('.y-grid')
    .data(yGridLines)
    .enter()
    .append('line')
    .attr('class', 'y-grid')
    .attr('x1', 0)
    .attr('x2', chartWidth)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .style('stroke', 'gray')
    .style('stroke-opacity', 0.1)
    .style('stroke-width', 1);

    svg.append('line')
    .attr('x1', xScale(500))
    .attr('x2', xScale(500))
    .attr('y1', 0)
    .attr('y2', chartHeight)
    .style('stroke', 'gray')
    .style('stroke-opacity', 1)
    .style('stroke-width', 1);

    svg.append('line')
    .attr('x1', 0)
    .attr('x2', chartWidth)
    .attr('y1', yScale(500))
    .attr('y2', yScale(500))
    .style('stroke', 'gray')
    .style('stroke-opacity', 1)
    .style('stroke-width', 1);

    svg.append('text')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .attr('transform', 'rotate(-90)')
    .style('fill', 'gray')
    .style('font-size', '12px')
    .text('Відстань до зупинки громадського транспорту, м');

    svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .style('fill', 'gray')
    .style('font-size', '12px')
    .text('Відстань до зупинки маршрутки, м');

    svg.selectAll('.domain')
    .style('stroke', 'none');

    const filteredData = data.features.filter(d => 
      d.properties.nearest_public_transport_stop_dst <= 1000 && 
      d.properties.nearest_shuttle_stop_dst <= 1000
    );

    // Оновлюємо графік на основі того, що ми бачимо на мапі
    svg
      .selectAll('.public-transport')
      .data(filteredData)
      .enter()
      .append('circle')
      .attr('class', 'public-transport')
      .attr('cx', (d) => xScale(d.properties.nearest_public_transport_stop_dst))
      .attr('cy', (d) => yScale(d.properties.nearest_shuttle_stop_dst))
      .attr('r', 4)
      .style('fill', 'gray')
      .style('opacity', 0.05)
      .style('stroke', 'gray')
      .style('stroke-width', 2)
      .style('stroke-opacity', 1)
      .each(function (d) {
        if (!pointLayers[d.properties['@id']]) pointLayers[d.properties['@id']] = [];
        pointLayers[d.properties['@id']].push(d3.select(this));
      });

    function highlightPoint(id) {
      if (pointLayers[id]) {
        pointLayers[id].forEach((point) => point.style('fill', '#e815fe').style('stroke', '#e815fe').style('opacity', 0.2));
      }
    }

    function resetPoint(id) {
      if (pointLayers[id]) {
        pointLayers[id].forEach((point) => point.style('fill', 'gray').style('stroke', 'gray').style('opacity', 0.05));
      }
    }

    // Оновлюємо дані, які будівлі ми бачимо на мапи
    function updateVisiblePointsOnChart() {
      const bounds = scatterMap.getBounds();

      data.features.forEach((building) => {
        const latLngs = building.geometry.coordinates[0];
        const latLng = L.latLng(latLngs[0][1], latLngs[0][0]);

        const isInBounds = bounds.contains(latLng);

        if (isInBounds) {
          highlightPoint(building.properties['@id']);
        } else {
          resetPoint(building.properties['@id']);
        }
      });
    }

    // Оновлюємо дані видинимих будівель коли пересуваємо мапу
    scatterMap.on('moveend', updateVisiblePointsOnChart);
    updateVisiblePointsOnChart();

  // Список слів, які необов'язково вводити для пошуку
  const ignoreWords = ['вулиця', 'проспект', 'шосе', 'площа', 'бульвар', 'вул.', 'провулок'];

  function simplifyAddress(address) {
    // Переводимо адресу в нижній регістр і обрізаємо зайві пробіли
    const simplified = address.toLowerCase().trim();
    
    // Видаляємо непотрібні слова з адреси
    let simplifiedStreet = simplified;
    ignoreWords.forEach(word => {
      simplifiedStreet = simplifiedStreet.replace(new RegExp(`\\b${word}\\b`, 'g'), '').trim();
    });

    return simplifiedStreet;
  }

  // Пошук точки за адресою. Розділяємо назву вулиці на номер будинку комою
  function findPointByAddress(address) {

    return data.features.find((feature) => {
      const street = feature.properties['addr:street']?.toLowerCase();
      const houseNumber = feature.properties['addr:housenumber']?.toLowerCase();

      const simplifiedStreet = simplifyAddress(address.split(',')[0]?.trim());
      const simplifiedHouseNumber = address.split(',')[1]?.trim();

      return (
        street?.includes(simplifiedStreet) && houseNumber?.includes(simplifiedHouseNumber)
      );
    });
  }

  // Прибираємо виділення точки
  function resetAllPoints() {
    svg.selectAll('.public-transport')
      .style('fill', 'gray')
      .style('stroke', 'gray')
      .style('opacity', 0.05);
  }

  // Виділяємо потрібну точку
  function highlightPointOnChart(id) {
    resetAllPoints();
    if (pointLayers[id]) {
      pointLayers[id].forEach((point) =>
        point.style('fill', '#e815fe').style('stroke', '#e815fe').style('opacity', 1).raise()
      );
    }
  }

  // Якщо відстань більше 1000м, пишемо про це
  function showDistanceWarning(feature) {
    const warningElement = document.getElementById('distance-warning');

    if (
      feature.properties.nearest_public_transport_stop_dst > 1000 ||
      feature.properties.nearest_shuttle_stop_dst > 1000
    ) {
      warningElement.textContent = 'Дистанція більше 1000 метрів';
    } else {
      warningElement.textContent = '';
    }
  }

  // Обробка натискання кнопки "Знайти"
  const searchButton = document.getElementById('search-button');
  searchButton.addEventListener('click', () => {
    const address = document.getElementById('address-input').value.trim();

    if (address === '') {
      resetAllPoints();
      document.getElementById('distance-warning').textContent = '';
      return;
    }

    const matchedFeature = findPointByAddress(address);

    if (matchedFeature) {
      const buildingId = matchedFeature.properties['@id'];
      highlightPointOnChart(buildingId);
      showDistanceWarning(matchedFeature);
    } else {
      resetAllPoints();
      document.getElementById('distance-warning').textContent = 'Адресу не знайдено';
    }
  });
})
