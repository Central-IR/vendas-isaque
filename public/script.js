const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://vendas-api.onrender.com/api'; // AJUSTAR URL

let vendas = [];
let currentMonth = new Date();
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';
let relatorioMode = false;

console.log('🚀 Vendas iniciada');
console.log('📍 API URL:', API_URL);

document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
});

function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');

    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('vendasSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('vendasSession');
    }

    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }

    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary); color: var(--text-primary); text-align: center; padding: 2rem;">
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">${mensagem}</h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Somente usuários autenticados podem acessar esta área.</p>
            <a href="${PORTAL_URL}" style="display: inline-block; background: var(--btn-register); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir para o Portal</a>
        </div>
    `;
}

function inicializarApp() {
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
    initCalendar();
}

async function checkServerStatus() {
    try {
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadVendas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error);
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    const statusRelatorio = document.getElementById('connectionStatusRelatorio');
    const className = isOnline ? 'connection-status online' : 'connection-status offline';
    
    if (statusElement) statusElement.className = className;
    if (statusRelatorio) statusRelatorio.className = className;
}

function startPolling() {
    loadVendas();
    setInterval(() => {
        if (isOnline) loadVendas();
    }, 10000);
}

async function loadVendas() {
    if (!isOnline && !DEVELOPMENT_MODE) return;

    try {
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/vendas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('vendasSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) {
            console.error('❌ Erro ao carregar vendas:', response.status);
            return;
        }

        const data = await response.json();
        vendas = data;
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
    }
}

async function syncData() {
    if (!isOnline && !DEVELOPMENT_MODE) {
        showToast('Servidor offline. Não é possível sincronizar.', 'error');
        return;
    }

    showToast('Sincronizando dados...', 'info');
    await loadVendas();
    showToast('Dados sincronizados com sucesso!', 'success');
}

function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    updateDisplay();
}

function updateMonthDisplay() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    document.getElementById('currentMonth').textContent = `${monthName} ${year}`;
}

function toggleRelatorioMes() {
    relatorioMode = !relatorioMode;
    
    const mainView = document.getElementById('mainView');
    const relatorioView = document.getElementById('relatorioView');
    const splashRelatorio = document.getElementById('splashScreenRelatorio');
    
    if (relatorioMode) {
        // Entrando no Relatório Mês
        mainView.style.display = 'none';
        relatorioView.style.display = 'block';
        
        // Mostrar splash screen
        if (splashRelatorio) {
            splashRelatorio.style.display = 'flex';
            
            // Esconder splash após 3 segundos e mostrar conteúdo
            setTimeout(() => {
                splashRelatorio.style.display = 'none';
                updateRelatorioMes();
            }, 3000);
        } else {
            updateRelatorioMes();
        }
    } else {
        // Voltando para interface principal
        mainView.style.display = 'block';
        relatorioView.style.display = 'none';
        updateDisplay();
    }
}

function updateRelatorioMes() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    
    document.getElementById('relatorioMesNome').textContent = `${monthName} ${year}`;
    
    // Filtrar apenas vendas PAGAS do mês atual
    let vendasPagas = vendas.filter(v => {
        if (!v.dataPagamento || v.status !== 'PAGO') return false;
        
        const dataPag = new Date(v.dataPagamento);
        return dataPag.getMonth() === currentMonth.getMonth() &&
               dataPag.getFullYear() === currentMonth.getFullYear();
    });
    
    // Aplicar filtro de pesquisa
    const search = document.getElementById('searchRelatorio').value.toLowerCase();
    if (search) {
        vendasPagas = vendasPagas.filter(v => 
            (v.numeroNF || '').toLowerCase().includes(search) ||
            (v.orgao || '').toLowerCase().includes(search)
        );
    }
    
    // Ordenar por data de pagamento (crescente)
    vendasPagas.sort((a, b) => new Date(a.dataPagamento) - new Date(b.dataPagamento));
    
    const container = document.getElementById('relatorioContainer');
    
    if (vendasPagas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem;">
                    Nenhuma venda paga encontrada neste mês
                </td>
            </tr>
        `;
        document.getElementById('relatorioTotal').textContent = 'R$ 0,00';
        return;
    }
    
    let totalMes = 0;
    container.innerHTML = vendasPagas.map(venda => {
        const valor = parseFloat(venda.valorNF || 0);
        totalMes += valor;
        
        return `
            <tr>
                <td>${venda.numeroNF || '-'}</td>
                <td>${formatDate(venda.dataEmissao)}</td>
                <td>${venda.orgao || '-'}</td>
                <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong></td>
                <td>${formatDate(venda.dataEntrega)}</td>
                <td>${formatDate(venda.dataPagamento)}</td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('relatorioTotal').textContent = `R$ ${totalMes.toFixed(2).replace('.', ',')}`;
}

function filterRelatorio() {
    updateRelatorioMes();
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    if (relatorioMode) {
        updateRelatorioMes();
    } else {
        updateMonthDisplay();
        updateDashboard();
        updateTable();
    }
}

function updateDashboard() {
    const monthVendas = getVendasForCurrentMonth();
    
    let totalPago = 0;
    let totalAReceber = 0;
    let totalEntregue = 0;
    let totalFaturado = 0;
    
    monthVendas.forEach(venda => {
        const valor = parseFloat(venda.valorNF || 0);
        totalFaturado += valor;
        
        if (venda.status === 'PAGO') {
            totalPago += valor;
        } else {
            totalAReceber += valor;
        }
        
        if (venda.dataEntrega) {
            totalEntregue++;
        }
    });
    
    document.getElementById('totalPago').textContent = formatCurrency(totalPago);
    document.getElementById('totalAReceber').textContent = formatCurrency(totalAReceber);
    document.getElementById('totalEntregue').textContent = totalEntregue;
    document.getElementById('totalFaturado').textContent = formatCurrency(totalFaturado);
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    let filteredVendas = getVendasForCurrentMonth();
    
    const search = document.getElementById('search').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numeroNF || '').toLowerCase().includes(search) ||
            (v.orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus) {
        filteredVendas = filteredVendas.filter(v => v.status === filterStatus);
    }
    
    if (filteredVendas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    Nenhuma venda encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    filteredVendas.sort((a, b) => new Date(b.dataEmissao) - new Date(a.dataEmissao));
    
    container.innerHTML = filteredVendas.map(venda => `
        <tr>
            <td><strong>${venda.numeroNF || '-'}</strong></td>
            <td>${formatDate(venda.dataEmissao)}</td>
            <td>${venda.orgao || '-'}</td>
            <td><strong>R$ ${parseFloat(venda.valorNF || 0).toFixed(2).replace('.', ',')}</strong></td>
            <td>${venda.tipo || '-'}</td>
            <td>
                <span class="badge ${venda.status === 'PAGO' ? 'aprovada' : 'reprovada'}">
                    ${venda.status || 'PENDENTE'}
                </span>
            </td>
            <td class="actions-cell">
                <div class="actions">
                    <button onclick="viewVenda('${venda.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getVendasForCurrentMonth() {
    return vendas.filter(venda => {
        const vendaDate = new Date(venda.dataEmissao);
        return vendaDate.getMonth() === currentMonth.getMonth() &&
               vendaDate.getFullYear() === currentMonth.getFullYear();
    });
}

function viewVenda(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('modalNumeroNF').textContent = venda.numeroNF || '-';
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="info-section">
            <h4>Informações Gerais</h4>
            <p><strong>Nº NF:</strong> ${venda.numeroNF || '-'}</p>
            <p><strong>Data Emissão:</strong> ${formatDate(venda.dataEmissao)}</p>
            <p><strong>Órgão:</strong> ${venda.orgao || '-'}</p>
            <p><strong>Valor:</strong> R$ ${parseFloat(venda.valorNF || 0).toFixed(2).replace('.', ',')}</p>
            <p><strong>Tipo:</strong> ${venda.tipo || '-'}</p>
            <p><strong>Status:</strong> ${venda.status || 'PENDENTE'}</p>
            ${venda.dataEntrega ? `<p><strong>Data Entrega:</strong> ${formatDate(venda.dataEntrega)}</p>` : ''}
            ${venda.dataPagamento ? `<p><strong>Data Pagamento:</strong> ${formatDate(venda.dataPagamento)}</p>` : ''}
        </div>
    `;
    
    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('show');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

function showToast(message, type = 'success') {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// CALENDAR FUNCTIONS
let calendarYear = new Date().getFullYear();

function initCalendar() {
    calendarYear = currentMonth.getFullYear();
    renderCalendar();
}

function toggleCalendar() {
    const modal = document.getElementById('calendarModal');
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        document.getElementById('calendarYear').textContent = calendarYear;
        renderCalendar();
    }
}

function changeCalendarYear(direction) {
    calendarYear += direction;
    document.getElementById('calendarYear').textContent = calendarYear;
    renderCalendar();
}

function renderCalendar() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const container = document.getElementById('calendarMonths');
    container.innerHTML = months.map((month, index) => {
        const isCurrentMonth = index === currentMonth.getMonth() && 
                              calendarYear === currentMonth.getFullYear();
        return `
            <button class="month-btn ${isCurrentMonth ? 'active' : ''}" 
                    onclick="selectMonth(${index})">
                ${month}
            </button>
        `;
    }).join('');
}

function selectMonth(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    toggleCalendar();
    updateDisplay();
}
