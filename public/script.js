const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://vendas-isaque.onrender.com/api';

let vendas = [];
let currentMonth = new Date();
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';
let relatorioMode = false;

console.log('🚀 Vendas Isaque iniciada');
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
            console.error('❌ Erro ao carregar vendas:', response.status, response.statusText);
            isOnline = false;
            updateConnectionStatus();
            return;
        }

        const data = await response.json();
        
        // Validar se data é um array
        if (!Array.isArray(data)) {
            console.error('❌ Resposta inválida da API:', data);
            return;
        }
        
        vendas = data;
        isOnline = true;
        updateConnectionStatus();
        
        const newHash = JSON.stringify(vendas.map(v => v.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            updateDisplay();
        }
        
        console.log(`[${new Date().toLocaleTimeString()}] 33 fretes carregados`);
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        isOnline = false;
        updateConnectionStatus();
    }
}

async function syncData() {
    if (!isOnline && !DEVELOPMENT_MODE) {
        showToast('Servidor offline. Não é possível sincronizar.', 'error');
        return;
    }

    try {
        showToast('Sincronizando dados...', 'info');
        
        const headers = { 'Accept': 'application/json' };
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        // Chamar endpoint de sync
        const response = await fetch(`${API_URL}/sync`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error('Erro ao sincronizar');
        }

        const result = await response.json();
        console.log('✅ Sincronização:', result);
        
        // Recarregar vendas
        await loadVendas();
        showToast('Dados sincronizados com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar dados', 'error');
    }
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
    const modal = document.getElementById('relatorioModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        gerarRelatorioMes();
        modal.classList.add('show');
    }
}

function gerarRelatorioMes() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[currentMonth.getMonth()];
    const year = currentMonth.getFullYear();
    
    const tituloElem = document.getElementById('relatorioModalTitulo');
    if (tituloElem) {
        tituloElem.textContent = `Relatório de Pagamentos - ${monthName} ${year}`;
    }
    
    const vendasPagas = vendas.filter(v => {
        if (v.origem !== 'CONTAS_RECEBER' || !v.data_pagamento) return false;
        
        const dataPagamento = new Date(v.data_pagamento + 'T00:00:00');
        return dataPagamento.getMonth() === currentMonth.getMonth() && 
               dataPagamento.getFullYear() === currentMonth.getFullYear();
    });
    
    const modalBody = document.getElementById('relatorioModalBody');
    if (!modalBody) return;
    
    if (vendasPagas.length === 0) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 1rem; opacity: 0.5;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600;">Nenhum pagamento registrado neste mês</p>
            </div>
        `;
        return;
    }
    
    const totalPago = vendasPagas.reduce((sum, v) => sum + (parseFloat(v.valor_nf) || 0), 0);
    
    modalBody.innerHTML = `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);">Total de Pagamentos:</span>
                <span style="font-size: 1.5rem; font-weight: 700; color: #22C55E;">${formatCurrency(totalPago)}</span>
            </div>
            <div style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                ${vendasPagas.length} pagamento${vendasPagas.length !== 1 ? 's' : ''} registrado${vendasPagas.length !== 1 ? 's' : ''}
            </div>
        </div>
        
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--th-bg); color: var(--th-color);">
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Nº NF</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Órgão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Emissão</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid var(--th-border); font-weight: 600;">Data Pagamento</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid var(--th-border); font-weight: 600;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${vendasPagas.map((venda, index) => `
                        <tr style="background: ${index % 2 === 0 ? 'var(--bg-card)' : 'var(--table-stripe)'};">
                            <td style="padding: 12px; border: 1px solid var(--border-color);"><strong>${venda.numero_nf}</strong></td>
                            <td style="padding: 12px; border: 1px solid var(--border-color);">${venda.nome_orgao}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); white-space: nowrap;">${formatDate(venda.data_pagamento)}</td>
                            <td style="padding: 12px; border: 1px solid var(--border-color); text-align: right;"><strong>${formatCurrency(venda.valor_nf)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background: rgba(34, 197, 94, 0.1); border-top: 3px solid #22C55E;">
                        <td colspan="4" style="padding: 14px 12px; border: 1px solid var(--border-color); font-weight: 700; font-size: 1rem; color: var(--text-primary);">TOTAL GERAL</td>
                        <td style="padding: 14px 12px; border: 1px solid var(--border-color); text-align: right; font-weight: 700; font-size: 1.1rem; color: #22C55E;">${formatCurrency(totalPago)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

function closeRelatorioModal() {
    const modal = document.getElementById('relatorioModal');
    if (modal) modal.classList.remove('show');
}

function closeRelatorioModal() {
    const modal = document.getElementById('relatorioModal');
    if (modal) modal.classList.remove('show');
}

function filterVendas() {
    updateTable();
}

function updateDisplay() {
    updateMonthDisplay();
    updateDashboard();
    updateTable();
}

function updateDashboard() {
    let totalPago = 0;
    let totalAReceber = 0;
    let quantidadeEntregue = 0;
    let totalFaturado = 0;
    
    vendas.forEach(venda => {
        const valor = parseFloat(venda.valor_nf || 0);
        
        // FATURADO: Soma TUDO
        totalFaturado += valor;
        
        // PAGO: origem CONTAS_RECEBER com data_pagamento
        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
            totalPago += valor;
            quantidadeEntregue++;
        }
        // A RECEBER: origem CONTROLE_FRETE com status ENTREGUE (mas ainda não pago)
        else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
            totalAReceber += valor;
            quantidadeEntregue++;
        }
    });
    
    document.getElementById('totalPago').textContent = formatCurrency(totalPago);
    document.getElementById('totalAReceber').textContent = formatCurrency(totalAReceber);
    document.getElementById('totalEntregue').textContent = quantidadeEntregue;
    document.getElementById('totalFaturado').textContent = formatCurrency(totalFaturado);
}

function updateTable() {
    const container = document.getElementById('vendasContainer');
    if (!container) return;
    
    let filteredVendas = getVendasForCurrentMonth();
    
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    
    if (search) {
        filteredVendas = filteredVendas.filter(v => 
            (v.numero_nf || '').toLowerCase().includes(search) ||
            (v.nome_orgao || '').toLowerCase().includes(search)
        );
    }
    
    if (filterStatus === 'PAGO') {
        filteredVendas = filteredVendas.filter(v => v.origem === 'CONTAS_RECEBER' && v.data_pagamento);
    } else if (filterStatus) {
        // Filtrar por qualquer status de frete
        filteredVendas = filteredVendas.filter(v => {
            if (v.origem === 'CONTROLE_FRETE') {
                const statusNormalizado = (v.status_frete || '').toUpperCase().replace(/\s+/g, '_');
                return statusNormalizado === filterStatus;
            }
            return false;
        });
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
    
    filteredVendas.sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    
    container.innerHTML = filteredVendas.map(venda => {
        let status = '';
        let statusClass = '';
        let rowClass = '';
        
        // LÓGICA CORRETA DE STATUS
        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
            // Conta paga
            status = 'PAGO';
            statusClass = 'pago';
            rowClass = 'row-pago';
        } else if (venda.origem === 'CONTROLE_FRETE') {
            // Usa o status real do frete
            status = venda.status_frete || 'EM_TRANSITO';
            
            // Define a classe baseada no status
            if (status === 'ENTREGUE') {
                statusClass = 'entregue';
                rowClass = 'row-entregue';
            } else if (status === 'EM_TRANSITO' || status === 'EM TRÂNSITO') {
                statusClass = 'transito';
            } else if (status === 'AGUARDANDO_COLETA' || status === 'AGUARDANDO COLETA') {
                statusClass = 'aguardando';
            } else if (status === 'EXTRAVIADO') {
                statusClass = 'extraviado';
            } else if (status === 'DEVOLVIDO') {
                statusClass = 'devolvido';
            } else {
                statusClass = 'transito';
            }
        }
        
        return `
        <tr class="${rowClass}">
            <td><strong>${venda.numero_nf || '-'}</strong></td>
            <td style="white-space: nowrap;">${formatDate(venda.data_emissao)}</td>
            <td>${venda.nome_orgao || '-'}</td>
            <td><strong>${formatCurrency(venda.valor_nf)}</strong></td>
            <td>${venda.tipo_nf || '-'}</td>
            <td>
                <span class="badge ${statusClass}">${status.replace(/_/g, ' ')}</span>
            </td>
            <td class="actions-cell">
                <div class="actions">
                    <button onclick="viewVenda('${venda.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

function getVendasForCurrentMonth() {
    return vendas.filter(venda => {
        const vendaDate = new Date(venda.data_emissao);
        return vendaDate.getMonth() === currentMonth.getMonth() &&
               vendaDate.getFullYear() === currentMonth.getFullYear();
    });
}

function viewVenda(id) {
    const venda = vendas.find(v => v.id === id);
    if (!venda) return;
    
    document.getElementById('modalNumeroNF').textContent = venda.numero_nf || '-';
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="info-section">
            <h4>Informações Gerais</h4>
            <p><strong>Nº NF:</strong> ${venda.numero_nf || '-'}</p>
            <p><strong>Data Emissão:</strong> ${formatDate(venda.data_emissao)}</p>
            <p><strong>Órgão:</strong> ${venda.nome_orgao || '-'}</p>
            <p><strong>Valor:</strong> R$ ${parseFloat(venda.valor_nf || 0).toFixed(2).replace('.', ',')}</p>
            <p><strong>Tipo:</strong> ${venda.tipo_nf || '-'}</p>
            ${venda.transportadora ? `<p><strong>Transportadora:</strong> ${venda.transportadora}</p>` : ''}
            ${venda.previsao_entrega ? `<p><strong>Previsão Entrega:</strong> ${formatDate(venda.previsao_entrega)}</p>` : ''}
            ${venda.data_pagamento ? `<p><strong>Data Pagamento:</strong> ${formatDate(venda.data_pagamento)}</p>` : ''}
            ${venda.observacoes ? `<p><strong>Observações:</strong> ${venda.observacoes}</p>` : ''}
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
    if (!value) return 'R$ 0,00';
    const num = parseFloat(value);
    return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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

// Event listener para fechar modais clicando fora
document.addEventListener('click', (e) => {
    const calendarModal = document.getElementById('calendarModal');
    const relatorioModal = document.getElementById('relatorioModal');
    
    if (calendarModal && e.target === calendarModal) {
        calendarModal.classList.remove('show');
    }
    if (relatorioModal && e.target === relatorioModal) {
        relatorioModal.classList.remove('show');
    }
});
