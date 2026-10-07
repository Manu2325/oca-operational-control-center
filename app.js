let currentTab = 'c-tracker';
let pkAgentSheets = [];
let autoRefreshTimer = null;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
    initOCADashboard();
    startAutoRefresh();
});

async function initOCADashboard() {
    await fetchPKAgentTabs();
    switchTab('c-tracker');
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
    currentTab = tabKey;
    const dropdown = document.getElementById('pk-agents-dropdown');
    if (dropdown && !tabKey.startsWith('PK')) dropdown.value = '';

    // Actualiza la clase activa de los botones
    const allTabBtns = document.querySelectorAll('.tab-btn-futuristic');
    allTabBtns.forEach(btn => btn.classList.remove('active-tab'));

    const activeBtn = document.getElementById(`tab-${tabKey}`);
    if (activeBtn) {
        activeBtn.classList.add('active-tab');
    }

    // Mapa de pestañas en Google Sheets
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
        'failed-calls': 'Failed Calls',
        'vivit': 'VIVIT RST',
        'dnc': 'Do Not Calls',
        'directory': 'Directory OCA'
    };

    const sheetName = tabMapping[tabKey] || tabKey;

    if (tabKey === 'collection') {
        renderCollectionResultsView();
    } else if (tabKey === 'dnc') {
        await loadDNCView(sheetName);
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

// Vista con Dropdown para Collection Results (Daily vs MTD)
async function renderCollectionResultsView() {
    const container = document.getElementById('sheet-view-container');
    container.innerHTML = `
        <div class="bg-slate-900/90 border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
            <span class="text-xs font-bold font-orbitron text-cyan-400 uppercase tracking-widest">Seleccionar Reporte:</span>
            <select id="collection-view-select" onchange="loadCollectionSubView(this.value)" class="bg-slate-950 border border-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg outline-none focus:border-cyan-400">
                <option value="daily">Daily Collected (Filas 16-26, Col A-I)</option>
                <option value="mtd">MTD Results (Filas 1-9, Col A-R)</option>
            </select>
        </div>
        <div id="collection-content-area" class="mt-4"></div>
    `;
    loadCollectionSubView('daily');
}

async function loadCollectionSubView(subType) {
    const subContainer = document.getElementById('collection-content-area');
    subContainer.innerHTML = `<div class="text-center py-10 text-xs text-slate-400">Cargando reporte...</div>`;

    const range = subType === 'daily' ? 'Collection Results!A16:I26' : 'Collection Results!A1:R9';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${CONFIG.API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        renderBasicTable(subContainer, data.values || [], subType === 'daily' ? 'Daily Collected' : 'MTD Results');
    } catch (e) {
        subContainer.innerHTML = `<div class="text-rose-400 text-xs p-4">Error al cargar datos.</div>`;
    }
}

// Vista Do Not Calls con Formulario
async function loadDNCView(sheetName) {
    const container = document.getElementById('sheet-view-container');
    container.innerHTML = `
        <div class="bg-slate-900/90 border border-cyan-500/30 p-5 rounded-2xl shadow-xl mb-6">
            <h3 class="text-xs font-orbitron font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                ➕ Registrar Nuevo Número (Do Not Call)
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" id="dnc-account" placeholder="Account # (Opcional)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="dnc-phone" placeholder="Phone DNC *" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <input type="text" id="dnc-reason" placeholder="Reason *" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none">
                <button onclick="submitDNCRecord()" class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md">
                    Guardar Registro
                </button>
            </div>
            <div id="dnc-msg" class="mt-2 text-[11px]"></div>
        </div>
        <div id="dnc-table-area"></div>
    `;

    await loadGenericSheetView('Do Not Calls', 'dnc-table-area');
}

async function submitDNCRecord() {
    const phone = document.getElementById('dnc-phone').value.trim();
    const reason = document.getElementById('dnc-reason').value.trim();
    const account = document.getElementById('dnc-account').value.trim();
    const msg = document.getElementById('dnc-msg');

    if (!phone || !reason) {
        msg.className = "text-rose-400 font-semibold";
        msg.textContent = "Por favor ingresa Phone DNC y Reason.";
        return;
    }

    msg.className = "text-amber-400 font-semibold";
    msg.textContent = "Guardando en Google Sheets...";

    try {
        await fetch(CONFIG.WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addDNC', account, phone, reason })
        });

        msg.className = "text-emerald-400 font-semibold";
        msg.textContent = "¡Registro guardado con éxito!";
        document.getElementById('dnc-phone').value = '';
        document.getElementById('dnc-reason').value = '';
        document.getElementById('dnc-account').value = '';

        setTimeout(() => loadDNCView('Do Not Calls'), 1200);
    } catch (e) {
        msg.className = "text-rose-400 font-semibold";
        msg.textContent = "Error al guardar el registro.";
    }
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

// Carga de pestañas genéricas filtrando filas ocultas y manteniendo rangos abiertos
async function loadGenericSheetView(sheetName, targetElementId = 'sheet-view-container') {
    const target = document.getElementById(targetElementId);
    if (!target) return;

    try {
        const isDishFbk = sheetName.toUpperCase().includes('DISH FBK');
        const isCompliance = sheetName.toUpperCase().includes('COMPLIANCE');
        const isCTracker = sheetName.toUpperCase().includes('C-TRACKER') || sheetName.toUpperCase().includes('TRACKER');

        // Determinamos el rango de columnas adecuado
        let rangeParam = 'A1:AK100';
        if (isCTracker) {
            rangeParam = 'A1:I'; // Columna A a la I para C-Tracker
        } else if (isDishFbk) {
            rangeParam = 'A1:Z100';
        } else if (isCompliance) {
            rangeParam = 'A1:S';
        }

        // Si es C-Tracker o pestañas muy pesadas, usamos la API ultra-rápida de valores
        if (isCTracker) {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/'${encodeURIComponent(sheetName)}'!${rangeParam}?key=${CONFIG.API_KEY}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Error al cargar datos de "${sheetName}"`);

            const data = await res.json();
            const rawRows = data.values || [];

            // Si hay más de 500 filas, mostramos el encabezado + los últimos 500 registros para velocidad máxima
            let finalRows = rawRows;
            if (rawRows.length > 500) {
                const header = rawRows[0];
                const recentRows = rawRows.slice(-500);
                finalRows = [header, ...recentRows];
            }

            renderBasicTable(target, finalRows, sheetName);
            return;
        }

        // Para otras pestañas con filtrado de filas ocultas
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
        
        // Estilo de encabezado sin encimado (usamos font-rajdhani en lugar de orbitron para mayor legibilidad y empaquetado)
        const rowClass = isHeader 
            ? 'bg-slate-950 font-rajdhani font-bold text-cyan-300 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800' 
            : 'hover:bg-slate-800/40 text-slate-200 transition-colors';

        html += `<tr class="${rowClass}">`;
        
        // Mostramos únicamente las primeras 8 columnas principales (de la A a la H)
        const displayCols = row.slice(0, 8);
        
        displayCols.forEach((cell, colIdx) => {
            let cellContent = cell !== undefined ? cell : '';
            let extraStyle = '';
            
            // Definimos anchos y ajustes de texto específicos para cada columna para evitar solapamientos
            let cellClass = 'px-3 py-2.5 border-r border-slate-800/50 align-top ';

            if (isHeader) {
                // Encabezados: Permitimos salto de línea suave y espacio suficiente
                cellClass += 'whitespace-normal break-words min-w-[110px] text-[11px] leading-tight ';
            } else {
                if (colIdx === 0) cellClass += 'min-w-[130px] whitespace-nowrap font-medium '; // Pick #
                else if (colIdx === 1) cellClass += 'min-w-[120px] whitespace-nowrap font-mono text-slate-300 '; // Account #
                else if (colIdx === 2) cellClass += 'min-w-[130px] whitespace-nowrap font-semibold text-cyan-200 '; // Agent Name
                else if (colIdx === 3) cellClass += 'min-w-[90px] whitespace-nowrap text-slate-400 '; // Date
                else if (colIdx === 4) {
                    // Call Recording Link
                    cellClass += 'min-w-[130px] max-w-[160px] whitespace-normal break-all text-[11px] ';
                    if (cellContent.startsWith('http')) {
                        cellContent = `<a href="${cellContent}" target="_blank" class="text-cyan-400 underline hover:text-cyan-300 font-semibold">Link Grabación</a>`;
                    }
                } 
                else if (colIdx === 5) cellClass += 'min-w-[260px] max-w-[350px] whitespace-normal break-words text-[11px] leading-relaxed '; // Comment
                else cellClass += 'min-w-[90px] text-center whitespace-nowrap '; // Pass/Fail & Score
            }

            // Formato condicional para PASS / FAIL
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

    // Panel de la gráfica para DISH Fbk
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

// Generación de la gráfica leyendo la tabla secundaria de Semanas
function renderDishFbkChart(rows) {
    const labels = [];
    const dataValues = [];

    // Recorremos las celdas buscando la tabla resumen
    rows.forEach(row => {
        row.forEach((cell, colIdx) => {
            const valStr = (cell || '').toString().trim();
            
            // Busca celdas como "Week 7th", "Week 8th", "Week 27th", etc.
            if (/^week\s*\d+/i.test(valStr) || /^wk\s*\d+/i.test(valStr)) {
                // El porcentaje está en la celda contigua (colIdx + 1)
                const nextCell = (row[colIdx + 1] || '').toString().trim();
                let num = parseFloat(nextCell.replace(/[%$,]/g, ''));

                if (!isNaN(num)) {
                    // Convertimos decimales tipo 0.2 a 20%
                    if (num <= 1 && num > 0) {
                        num = num * 100;
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

    // Datos por defecto de respaldo si la API devuelve filas vacías
    const finalLabels = labels.length > 0 ? labels : ['Week 7th', 'Week 8th', 'Week 9th', 'Week 10th', 'Week 11th', 'Week 27th'];
    const finalValues = dataValues.length > 0 ? dataValues : [20, 60, 50, 60, 20, 100];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: finalLabels,
            datasets: [{
                label: 'Results %',
                data: finalValues,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                borderWidth: 3,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#06b6d4',
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.25,
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