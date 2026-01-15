require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Função para sincronizar dados de TODOS os vendedores (ROBERTO, ISAQUE, MIGUEL)
async function syncVendas() {
  try {
    console.log('🔄 Sincronizando dados de todos os vendedores...');

    const vendedores = ['ROBERTO', 'ISAQUE', 'MIGUEL'];
    const registrosParaInserir = [];

    for (const vendedor of vendedores) {
      // 1. Buscar registros do Controle de Frete
      const { data: freteData, error: freteError } = await supabase
        .from('controle_frete')
        .select('*')
        .eq('vendedor', vendedor)
        .order('numero_nf', { ascending: true });

      if (freteError) {
        console.error(`Erro ao buscar frete de ${vendedor}:`, freteError);
        continue;
      }

      // 2. Buscar registros do Contas a Receber
      const { data: contasData, error: contasError } = await supabase
        .from('contas_receber')
        .select('*')
        .eq('vendedor', vendedor)
        .order('numero_nf', { ascending: true });

      if (contasError) {
        console.error(`Erro ao buscar contas de ${vendedor}:`, contasError);
        continue;
      }

      // 3. Criar mapa de NFs pagas
      const nfsPagas = new Map();
      if (contasData) {
        contasData.forEach(conta => {
          if (conta.status === 'PAGO' && conta.data_pagamento) {
            nfsPagas.set(conta.numero_nf, conta);
          }
        });
      }

      // 4. Processar registros do vendedor
      const nfsProcessadas = new Set();

      // Prioridade 2: Contas pagas
      nfsPagas.forEach((conta, numero_nf) => {
        registrosParaInserir.push({
          numero_nf: numero_nf,
          origem: 'CONTAS_RECEBER',
          data_emissao: conta.data_emissao,
          valor_nf: conta.valor,
          tipo_nf: conta.tipo_nf,
          nome_orgao: conta.orgao,
          vendedor: vendedor,
          banco: conta.banco,
          data_vencimento: conta.data_vencimento,
          data_pagamento: conta.data_pagamento,
          status_pagamento: conta.status,
          observacoes: conta.observacoes,
          id_contas_receber: conta.id,
          prioridade: 2
        });
        nfsProcessadas.add(numero_nf);
      });

      // Prioridade 1: Todos os fretes
      if (freteData) {
        freteData.forEach(frete => {
          if (!nfsProcessadas.has(frete.numero_nf)) {
            registrosParaInserir.push({
              numero_nf: frete.numero_nf,
              origem: 'CONTROLE_FRETE',
              data_emissao: frete.data_emissao,
              valor_nf: frete.valor_nf,
              tipo_nf: frete.tipo_nf,
              nome_orgao: frete.nome_orgao,
              vendedor: vendedor,
              documento: frete.documento,
              contato_orgao: frete.contato_orgao,
              transportadora: frete.transportadora,
              valor_frete: frete.valor_frete,
              data_coleta: frete.data_coleta,
              cidade_destino: frete.cidade_destino,
              previsao_entrega: frete.previsao_entrega,
              status_frete: frete.status,
              id_controle_frete: frete.id,
              prioridade: 1
            });
          }
        });
      }
    }

    // 5. Limpar tabela vendas e inserir novos dados
    const { error: deleteError } = await supabase
      .from('vendas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos

    if (deleteError) console.error('Erro ao limpar tabela:', deleteError);

    if (registrosParaInserir.length > 0) {
      const { error: insertError } = await supabase
        .from('vendas')
        .insert(registrosParaInserir);

      if (insertError) throw insertError;
    }

    console.log(`✅ Sincronização concluída: ${registrosParaInserir.length} registros`);
    return { success: true, count: registrosParaInserir.length };

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    throw error;
  }
}

// API Endpoints

// GET /api/sync - Sincronizar dados
app.get('/api/sync', async (req, res) => {
  try {
    const result = await syncVendas();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vendas - Listar todas as vendas
app.get('/api/vendas', async (req, res) => {
  try {
    // Sincronizar antes de buscar
    await syncVendas();

    const { data, error } = await supabase
      .from('vendas')
      .select('*')
      .order('numero_nf', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard - Dashboard com estatísticas
app.get('/api/dashboard', async (req, res) => {
  try {
    await syncVendas();

    const { data, error } = await supabase
      .from('vendas')
      .select('*');

    if (error) throw error;

    const stats = {
      pago: 0,
      aReceber: 0,
      entregue: 0,
      faturado: 0
    };

    if (data) {
      data.forEach(venda => {
        const valor = parseFloat(venda.valor_nf) || 0;
        
        // Faturado = tudo
        stats.faturado += valor;

        if (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento) {
          // Pago
          stats.pago += valor;
        } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
          // A receber (entregue mas não pago)
          stats.aReceber += valor;
          stats.entregue += 1;
        }
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sincronização automática a cada 5 minutos
setInterval(async () => {
  try {
    await syncVendas();
  } catch (error) {
    console.error('Erro na sincronização automática:', error);
  }
}, 5 * 60 * 1000);

// Sincronização inicial
syncVendas().catch(console.error);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Vendas Consolidada - Sistema de Monitoramento`);
});
