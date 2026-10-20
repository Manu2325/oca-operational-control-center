let currentTab = 'collection';
let pkAgentSheets = [];
let autoRefreshTimer = null;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
    initOCADashboard();
    startAutoRefresh();
});

async function initOCADashboard() {
    await fetchPKAgentTabs();
    switchTab('collection');
}

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        refreshCurrentView();
    }, REFRESH_INTERVAL_MS);
}

// Carga las pestañas que empiezan por "PK" desde Google Sheets
async function fetchPKAgentTabs() {
    const dropdown = document.getElementById('pk-agents-dropdown');
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?fields=sheets.properties.title&key=${CONFIG.API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        pkAgentSheets = (data.sheets || [])
            .map(s => s.properties.title)
            .filter(title => title.toUpperCase().startsWith('PK'));

        if (dropdown) {
            dropdown.innerHTML = `<option value="">⚡ PK AGENTS MODULE</option>` +
                pkAgentSheets.map(pk => `<option value="${pk}">${pk}</option>`).join('');
        }
    } catch (err) {
        console.error("Error al cargar PK Agents:", err);
        if (dropdown) dropdown.innerHTML = `<option value="">Error cargando agentes</option>`;
    }
}

async function switchTab(tabKey) {
    if (!tabKey) return; // Si seleccionan la opción vacía/placeholder, ignora
    
    currentTab = tabKey;
    
    // Resetear PK Agents Dropdown si no se está usando
    const pkDropdown = document.getElementById('pk-agents-dropdown');
    if (pkDropdown && !tabKey.startsWith('PK')) pkDropdown.value = '';

    // Gestión del Trackers Dropdown
    const trackerDropdown = document.getElementById('trackers-dropdown');
    if (trackerDropdown) {
        if (tabKey === 'c-tracker' || tabKey === 'dish-acc') {
            trackerDropdown.value = tabKey;
            trackerDropdown.classList.add('border-cyan-400', 'ring-1', 'ring-cyan-400');
        } else {
            // Si navegamos a otra pestaña, vuelve al encabezado neutral
            trackerDropdown.value = '';
            trackerDropdown.classList.remove('border-cyan-400', 'ring-1', 'ring-cyan-400');
        }
    }

    // Actualiza la clase activa de los botones estáticos
    const allTabBtns = document.querySelectorAll('.tab-btn-futuristic');
    allTabBtns.forEach(btn => btn.classList.remove('active-tab'));

    const activeBtn = document.getElementById(`tab-${tabKey}`);
    if (activeBtn) {
        activeBtn.classList.add('active-tab');
    }

    // Mapa de pestañas en Google Sheets
    const tabMapping = {
        'c-tracker': 'C-Tracker',
        'cost-fee': 'Cost/Fee Relation',
        'collection': 'Collection Results',
        'productivity': 'Productivity',
        'dish-acc': 'DISH ACC OCT',
        'dish-pbk': 'DISH Fbk', 
        'compliance': 'Compliance Calls',
        'qa-summary': 'QA Summary',
        'directory': 'Directory OCA'
    };

    const sheetName = tabMapping[tabKey] || tabKey;

    if (tabKey === 'collection') {
        renderCollectionResultsView();
    } else if (tabKey === 'cost-fee') {
        await loadStyledSheetView(sheetName, 'A1:Z50');
    } else if (tabKey === 'productivity') {
        await loadStyledSheetView(sheetName, 'A1:Z100');
    } else if (tabKey.startsWith('PK')) {
        await loadPKAgentView(tabKey);
    } else {
        await loadGenericSheetView(sheetName);
    }
}

function onPKAgentSelect(selectedSheet) {
    if (selectedSheet) {
        switchTab(selectedSheet);
    }
}

// Vista con Dropdown para Collection Results (Daily, MTD y Summary)
async function renderCollectionResultsView() {
    const container = document.getElementById('sheet-view-container');
    container.innerHTML = `
        <div class="bg-slate-900/90 border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
            <span class="text-xs font-bold font-orbitron text-cyan-400 uppercase tracking-widest">Seleccionar Reporte:</span>
            <select id="collection-view-select" onchange="loadCollectionSubView(this.value)" class="bg-slate-950 border border-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg outline-none focus:border-cyan-400 cursor-pointer">
                <option value="daily">Daily Collected (Filas 16-26, Col A-I)</option>
                <option value="mtd">MTD Results (Filas 1-9, Col A-R)</option>
                <option value="summary">Collection Summary (Filas 1-10, Col AT-BN)</option>
            </select>
        </div>
        <div id="collection-content-area" class="mt-4"></div>
    `;
    loadCollectionSubView('daily');
}

// Carga sub-vistas capturando colores y formatos reales de la hoja
async function loadCollectionSubView(subType) {
    const subContainer = document.getElementById('collection-content-area');
    subContainer.innerHTML = `<div class="text-center py-10 text-xs font-orbitron text-cyan-400 animate-pulse">Cargando reporte con formatos...</div>`;

    let range = 'Collection Results!A16:I26';
    let title = 'Daily Collected';

    if (subType === 'mtd') {
        range = 'Collection Results!A1:R9';
        title = 'MTD Results';
    } else if (subType === 'summary') {
        range = 'Collection Results!AT1:BN10';
        title = 'Collection Summary';
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?ranges=${encodeURIComponent(range)}&includeGridData=true&key=${CONFIG.API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Error al consultar Google Sheets");

        const json = await res.json();
        const gridData = json.sheets?.[0]?.data?.[0];
        const rowData = gridData?.rowData || [];

        renderStyledGridTable(subContainer, rowData, title);
    } catch (e) {
        subContainer.innerHTML = `<div class="text-rose-400 text-xs p-4 bg-slate-900 rounded-xl border border-rose-800">Error al cargar datos: ${e.message}</div>`;
    }
}

// Carga de pestañas con estilos complejos de Google Sheets
async function loadStyledSheetView(sheetName, rangeParam = 'A1:Z100', targetElementId = 'sheet-view-container') {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    target.innerHTML = `<div class="text-center py-10 text-xs font-orbitron text-cyan-400 animate-pulse">Cargando "${sheetName}" con estilos...</div>`;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?ranges=${encodeURIComponent(sheetName)}!${rangeParam}&includeGridData=true&key=${CONFIG.API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`No se pudo acceder a la pestaña "${sheetName}".`);

        const json = await res.json();
        const gridData = json.sheets?.[0]?.data?.[0];
        const rowData = gridData?.rowData || [];

        renderStyledGridTable(target, rowData, sheetName);
    } catch (err) {
        target.innerHTML = `<div class="p-6 bg-slate-900 rounded-xl border border-rose-800/50 text-rose-400 text-xs">Error cargando "${sheetName}": ${err.message}</div>`;
    }
}

// Renderizado estilizado con preservación de colores de fondo, fuentes y columna fija
function renderStyledGridTable(container, rowData, title) {
    if (!rowData || rowData.length === 0) {
        container.innerHTML = `<div class="p-6 bg-slate-900 text-slate-400 text-xs border border-slate-800 rounded-xl">Sin información disponible.</div>`;
        return;
    }

    let html = `
        <div class="bg-slate-900/90 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(6,182,212,0.15)] backdrop-blur-md">
            <div class="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-3.5 border-b border-cyan-500/20 flex justify-between items-center">
                <div class="flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
                    <span class="text-xs font-orbitron font-extrabold text-cyan-300 uppercase tracking-widest">${title}</span>
                </div>
                <span class="text-[10px] font-rajdhani font-bold text-slate-400 uppercase tracking-wider bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800 shadow-inner">
                    ← Desliza horizontalmente →
                </span>
            </div>
            
            <div class="custom-scroll overflow-x-auto max-h-[750px] relative">
                <table class="w-full text-xs text-left border-collapse">
                    <tbody class="divide-y divide-slate-800/60">
    `;

    rowData.forEach((row, rowIndex) => {
        const cells = row.values || [];
        if (cells.length === 0 || cells.every(c => c.formattedValue === undefined || c.formattedValue === '')) return;

        const isHeader = rowIndex === 0 || cells.some(c => (c.formattedValue || '').toLowerCase().includes('agent'));
        const tag = isHeader ? 'th' : 'td';
        const rowClass = isHeader 
            ? 'bg-slate-950/95 font-orbitron text-cyan-300 uppercase tracking-wider sticky top-0 z-30 border-b border-cyan-500/30 shadow-md' 
            : 'hover:bg-slate-800/40 transition-colors duration-150';

        html += `<tr class="${rowClass}">`;

        cells.forEach((cell, colIdx) => {
            const val = cell.formattedValue !== undefined ? cell.formattedValue : '';
            const fmt = cell.effectiveFormat || {};
            
            const bgRgb = fmt.backgroundColor || {};
            const r = Math.round((bgRgb.red || 0) * 255);
            const g = Math.round((bgRgb.green || 0) * 255);
            const b = Math.round((bgRgb.blue || 0) * 255);
            
            const hasCustomBg = bgRgb.red !== undefined || bgRgb.green !== undefined || bgRgb.blue !== undefined;
            const isPureWhite = r > 240 && g > 240 && b > 240;

            let styleAttr = '';

            const isFirstCol = colIdx === 0;
            let stickyClasses = '';

            if (isFirstCol) {
                stickyClasses = 'sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.6)] ';
                if (!hasCustomBg || isPureWhite) {
                    styleAttr += 'background-color: #0b1120; ';
                }
            }

            if (hasCustomBg && !isPureWhite) {
                styleAttr += `background-color: rgb(${r}, ${g}, ${b}); `;
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                styleAttr += brightness > 128 ? 'color: #020617; font-weight: 700; ' : 'color: #ffffff; font-weight: 700; ';
            } else {
                styleAttr += 'color: #f1f5f9; ';
            }

            if (fmt.textFormat?.bold) {
                styleAttr += 'font-weight: 700; ';
            }

            const alignClass = isFirstCol ? 'text-left font-bold' : 'text-center font-mono';

            html += `<${tag} class="px-3.5 py-2.5 border border-slate-800/50 align-middle whitespace-nowrap min-w-[110px] ${stickyClasses} ${alignClass}" style="${styleAttr}">${val}</${tag}>`;
        });

        html += `</tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Vista interactiva para PK Agent
async function loadPKAgentView(pkSheetName) {
    const container = document.getElementById('sheet-view-container');
    container.innerHTML = `
        <div class="bg-slate-900/90 border border-cyan-500/30 p-5 rounded-2xl shadow-xl mb-6">
            <h3 class="text-xs font-orbitron font-bold text-cyan-400 uppercase mb-3">
                ➕ Registrar Pago / Callback para: <span class="text-white">${pkSheetName}</span>
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="text" id="pk-customer" placeholder="Customer's Name *" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="pk-account" placeholder="Account *" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="pk-balance" placeholder="Company Balance" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="pk-followup" placeholder="Follow up Date" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="pk-method" placeholder="Payment Method" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="pk-desc" placeholder="Description" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none col-span-2">
                <button onclick="submitPKRecord('${pkSheetName}')" class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-bold text-xs px-4 py-2 rounded-xl shadow-md">
                    Guardar Registro
                </button>
            </div>
            <div id="pk-msg" class="mt-2 text-[11px]"></div>
        </div>
        <div id="pk-table-area"></div>
    `;

    await loadGenericSheetView(pkSheetName, 'pk-table-area');
}

async function submitPKRecord(pkSheetName) {
    const customerName = document.getElementById('pk-customer').value.trim();
    const account = document.getElementById('pk-account').value.trim();
    const companyBalance = document.getElementById('pk-balance').value.trim();
    const followUpDate = document.getElementById('pk-followup').value.trim();
    const paymentMethod = document.getElementById('pk-method').value.trim();
    const description = document.getElementById('pk-desc').value.trim();
    const msg = document.getElementById('pk-msg');

    if (!customerName || !account) {
        msg.className = "text-rose-400 font-semibold";
        msg.textContent = "Customer's Name y Account son obligatorios.";
        return;
    }

    msg.className = "text-amber-400 font-semibold";
    msg.textContent = "Guardando registro...";

    try {
        await fetch(CONFIG.WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'addPKRecord',
                sheetName: pkSheetName,
                customerName, account, companyBalance, followUpDate, paymentMethod, description
            })
        });

        msg.className = "text-emerald-400 font-semibold";
        msg.textContent = "¡Registro guardado correctamente!";
        setTimeout(() => loadPKAgentView(pkSheetName), 1200);
    } catch (e) {
        msg.className = "text-rose-400 font-semibold";
        msg.textContent = "Error al guardar el registro.";
    }
}

// Carga de pestañas genéricas con rango extendido para DISH FBK
async function loadGenericSheetView(sheetName, targetElementId = 'sheet-view-container') {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    try {
        const isDishFbk = sheetName.toUpperCase().includes('DISH FBK');
        const isCompliance = sheetName.toUpperCase().includes('COMPLIANCE');
        const isCTracker = sheetName.toUpperCase().includes('C-TRACKER') || sheetName.toUpperCase().includes('TRACKER');

        let rangeParam = 'A1:AK100';
        if (isCTracker) {
            rangeParam = 'A1:I';
        } else if (isDishFbk) {
            // Rango ampliado para traer todas las semanas y auditorías de DISH FBK
            rangeParam = 'A1:K300';
        } else if (isCompliance) {
            rangeParam = 'A1:S';
        }

        if (isCTracker) {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/'${encodeURIComponent(sheetName)}'!${rangeParam}?key=${CONFIG.API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Error al cargar datos de "${sheetName}"`);

            const data = await res.json();
            const rawRows = data.values || [];

            let finalRows = rawRows;
            if (rawRows.length > 500) {
                const header = rawRows[0];
                const recentRows = rawRows.slice(-500);
                finalRows = [header, ...recentRows];
            }

            renderBasicTable(target, finalRows, sheetName);
            return;
        }

        // Consultamos con includeGridData=true para capturar la estructura de semanas y colores
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?ranges=${encodeURIComponent(sheetName)}!${rangeParam}&includeGridData=true&key=${CONFIG.API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`No se pudo acceder a la pestaña "${sheetName}"`);

        const json = await res.json();
        const gridData = json.sheets?.[0]?.data?.[0];
        const rowData = gridData?.rowData || [];
        const rowMetadata = gridData?.rowMetadata || [];

        const visibleRows = [];

        rowData.forEach((row, index) => {
            const meta = rowMetadata[index] || {};
            const isHidden = meta.hiddenByFilter || meta.hiddenDimension;

            if (!isHidden && row.values) {
                const rowValues = row.values.map(cell => cell.formattedValue !== undefined ? cell.formattedValue : '');
                if (rowValues.some(val => val !== '')) {
                    visibleRows.push(rowValues);
                }
            }
        });

        renderBasicTable(target, visibleRows, sheetName);
    } catch (err) {
        target.innerHTML = `<div class="p-6 bg-slate-900 rounded-xl border border-rose-800/50 text-rose-400 text-xs">Error cargando "${sheetName}": ${err.message}</div>`;
    }
}

function renderBasicTable(container, rows, title) {
    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="p-6 bg-slate-900 text-slate-400 text-xs border border-slate-800 rounded-xl">Sin información disponible.</div>`;
        return;
    }

    const isDishFbk = title.toUpperCase().includes('DISH FBK');
    const isCTracker = title.toUpperCase().includes('C-TRACKER') || title.toUpperCase().includes('TRACKER');

    let html = `
        ${isDishFbk ? '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">' : ''}
        
        <div class="${isDishFbk ? 'lg:col-span-2' : ''} bg-slate-900/90 border border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl">
            <div class="bg-slate-900 px-6 py-3 border-b border-slate-800 flex justify-between items-center">
                <span class="text-xs font-orbitron font-bold text-cyan-400 uppercase tracking-widest">${title}</span>
            </div>
            <div class="custom-scroll overflow-x-auto max-h-[700px]">
                <table class="w-full text-xs text-left border-collapse">
                    <tbody class="divide-y divide-slate-800/50">
    `;

    rows.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0 || (row[0] && row[0].toString().includes('Pick #'));
        const tag = isHeader ? 'th' : 'td';
        
        const rowClass = isHeader 
            ? 'bg-slate-950 font-rajdhani font-bold text-cyan-300 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800' 
            : 'hover:bg-slate-800/40 text-slate-200 transition-colors';

        html += `<tr class="${rowClass}">`;
        
        const displayCols = isDishFbk ? row.slice(0, 8) : row;
        
        displayCols.forEach((cell, colIdx) => {
            let cellContent = cell !== undefined ? cell : '';
            let extraStyle = '';
            
            let cellClass = 'px-3 py-2.5 border-r border-slate-800/50 align-top ';

            if (isCTracker) {
                if (colIdx === 0) cellClass += 'min-w-[140px] whitespace-nowrap font-mono text-slate-400 ';
                else if (colIdx === 1) cellClass += 'min-w-[110px] whitespace-nowrap font-semibold text-slate-200 ';
                else if (colIdx === 2) cellClass += 'min-w-[130px] max-w-[150px] whitespace-nowrap font-mono font-bold text-cyan-400 ';
                else if (colIdx === 3) cellClass += 'min-w-[130px] whitespace-nowrap font-mono text-slate-300 ';
                else if (colIdx === 4) cellClass += 'min-w-[180px] whitespace-normal break-words ';
                else if (colIdx === 5) cellClass += 'min-w-[120px] whitespace-nowrap text-slate-300 ';
                else cellClass += 'min-w-[120px] whitespace-normal break-words ';
            } else if (isHeader) {
                cellClass += 'whitespace-normal break-words min-w-[110px] text-[11px] leading-tight ';
            } else {
                if (colIdx === 0) cellClass += 'min-w-[130px] whitespace-nowrap font-medium ';
                else if (colIdx === 1) cellClass += 'min-w-[120px] whitespace-nowrap font-mono text-slate-300 ';
                else if (colIdx === 2) cellClass += 'min-w-[130px] whitespace-nowrap font-semibold text-cyan-200 ';
                else if (colIdx === 3) cellClass += 'min-w-[90px] whitespace-nowrap text-slate-400 ';
                else if (colIdx === 4) {
                    cellClass += 'min-w-[130px] max-w-[160px] whitespace-normal break-all text-[11px] ';
                    if (cellContent.startsWith('http')) {
                        cellContent = `<a href="${cellContent}" target="_blank" class="text-cyan-400 underline hover:text-cyan-300 font-semibold">Link Grabación</a>`;
                    }
                } 
                else if (colIdx === 5) cellClass += 'min-w-[260px] max-w-[350px] whitespace-normal break-words text-[11px] leading-relaxed ';
                else cellClass += 'min-w-[90px] text-center whitespace-nowrap ';
            }

            if (!isHeader && cellContent.toString().toUpperCase() === 'PASS') {
                extraStyle = 'background-color: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700; text-align: center;';
            } else if (!isHeader && cellContent.toString().toUpperCase() === 'FAIL') {
                extraStyle = 'background-color: rgba(239, 68, 68, 0.2); color: #f87171; font-weight: 700; text-align: center;';
            }

            html += `<${tag} class="${cellClass}" style="${extraStyle}">${cellContent}</${tag}>`;
        });

        html += `</tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    if (isDishFbk) {
        html += `
            <div class="bg-slate-900/90 border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-2xl h-[480px]">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-orbitron font-bold text-cyan-400 uppercase tracking-widest">Results vs Week</span>
                    <span class="text-[10px] font-rajdhani font-bold text-slate-400 uppercase">DISH Pbk Performance</span>
                </div>
                <div class="relative flex-1 w-full h-full">
                    <canvas id="dishFbkChart"></canvas>
                </div>
            </div>
        </div>`;
    }

    container.innerHTML = html;

    if (isDishFbk) {
        renderDishFbkChart(rows);
    }
}

// Generación de la gráfica leyendo la tabla lateral de Semanas (Columnas J y K)
function renderDishFbkChart(rows) {
    const labels = [];
    const dataValues = [];

    // Recorremos las celdas buscando la tabla resumen de semanas (Week 7th a Week 37th)
    rows.forEach(row => {
        row.forEach((cell, colIdx) => {
            const valStr = (cell || '').toString().trim();
            
            // Detecta patrones de semanas como "Week 7th", "Week 27th", "Week 37th"
            if (/^week\s*\d+/i.test(valStr) || /^wk\s*\d+/i.test(valStr)) {
                const nextCell = (row[colIdx + 1] || '').toString().trim();
                let num = parseFloat(nextCell.replace(/[%\$,]/g, ''));

                if (!isNaN(num)) {
                    if (num <= 1 && num > 0) {
                        num = Math.round(num * 100);
                    }
                    labels.push(valStr);
                    dataValues.push(num);
                }
            }
        });
    });

    const ctx = document.getElementById('dishFbkChart');
    if (!ctx) return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Results %',
                data: dataValues,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                borderWidth: 3,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#06b6d4',
                pointRadius: 4,
                pointHoverRadius: 7,
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: { 
                        color: '#38bdf8',
                        font: { family: 'Orbitron', size: 10 },
                        callback: value => value + '%' 
                    },
                    grid: { color: 'rgba(51, 65, 85, 0.3)' }
                },
                x: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 9 },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { color: 'rgba(51, 65, 85, 0.15)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Result: ${context.parsed.y}%`;
                        }
                    }
                }
            }
        }
    });
}

function refreshCurrentView() {
    switchTab(currentTab);
}