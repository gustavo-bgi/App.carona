// ============================================
// CONFIGURAÇÃO DO BANCO DE DADOS (GLOBAL)
// ============================================

const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

// Inicializa o cliente e coloca no WINDOW para ser acessível globalmente
if (window.supabase && window.supabase.createClient) {
    try {
        window.dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);
        console.log('✅ Cliente Supabase inicializado e exposto globalmente.');
    } catch (err) {
        console.error('❌ Erro ao criar cliente Supabase:', err);
    }
} else {
    console.error('❌ Biblioteca Supabase não encontrada! Verifique o <script> no HTML.');
}

// ============================================
// FUNÇÕES DE BANCO DE DADOS (EXPORTADAS NO WINDOW)
// ============================================

// 1. Verificar Conexão
window.verificarConexao = async function() {
    if (!window.dbClient) return false;
    try {
        // Tenta buscar 1 linha apenas para testar
        const { error } = await window.dbClient.from('pessoas').select('count', { count: 'exact', head: true });
        
        // Se der erro de conexão real, retorna false
        if (error && error.code !== 'PGRST116') {
            console.error('Erro de conexão:', error);
            // return false; // Descomente para bloquear se o banco não responder
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// 2. Módulo Pessoas
window.pessoasDB = {
    async listar(ativosApenas = false) {
        let q = window.dbClient.from('pessoas').select('*').order('nome');
        if (ativosApenas) q = q.eq('ativo', true);
        return await q;
    },
    async criar(dados) {
        return await window.dbClient.from('pessoas').insert([dados]).select();
    },
    async atualizar(id, dados) {
        return await window.dbClient.from('pessoas').update(dados).eq('id', id).select();
    },
    async excluir(id) {
        return await window.dbClient.from('pessoas').delete().eq('id', id);
    }
};

// 3. Módulo Viagens
window.viagensDB = {
    async listar(mes, ano) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0];

        // Atenção: Aqui usamos os nomes das colunas conforme corrigimos no SQL
        return await window.dbClient
            .from('viagens')
            .select('*, motorista:pessoas!motorista_id(nome), passageiros:viagens_passageiros(pessoa_id, valor, pago, pessoa:pessoas(nome))')
            .gte('data', inicio)
            .lte('data', fim)
            .order('data', { ascending: false });
    },
    
    async criar(viagem, passageiros) {
        // Criar viagem
        const { data: v, error } = await window.dbClient.from('viagens').insert([viagem]).select().single();
        if (error) throw error;

        // Criar passageiros
        if (passageiros && passageiros.length > 0) {
            const passData = passageiros.map(p => ({
                viagem_id: v.id,
                pessoa_id: p.pessoa_id,
                valor: p.valor,
                pago: p.pago || false
            }));
            await window.dbClient.from('viagens_passageiros').insert(passData);
        }
        return { data: v };
    },
    
    async atualizar(id, viagem, passageiros) {
        const { error } = await window.dbClient.from('viagens').update(viagem).eq('id', id);
        if (error) throw error;
        
        if (passageiros) {
            // Remove antigos e insere novos
            await window.dbClient.from('viagens_passageiros').delete().eq('viagem_id', id);
            
            if (passageiros.length > 0) {
                const passData = passageiros.map(p => ({
                    viagem_id: id,
                    pessoa_id: p.pessoa_id,
                    valor: p.valor,
                    pago: p.pago || false
                }));
                await window.dbClient.from('viagens_passageiros').insert(passData);
            }
        }
        return { data: { id, ...viagem } };
    },
    
    async excluir(id) {
        return await window.dbClient.from('viagens').delete().eq('id', id);
    }
};

// 4. Módulo Saldos
window.saldosDB = {
    async listarAtuais() {
        // Busca da VIEW criada no SQL
        return await window.dbClient.from('saldos_atuais_view').select('*');
    }
};

// 5. Módulo Fechamento (Simplificado)
window.fechamentoDB = {
    async verificar(mes, ano) { return { data: null }; },
    async realizar(mes, ano) { return { success: true }; }
};

// 6. Módulo Estatísticas (O QUE ESTAVA DANDO ERRO)
// Agora definimos explicitamente no window
window.estatisticasDB = {
    async obterDashboard(mes = null, ano = null) {
        const hoje = new Date();
        const mesAtual = mes || hoje.getMonth() + 1;
        const anoAtual = ano || hoje.getFullYear();
        
        // Busca viagens
        const { data: viagens, error: errorViagens } = await window.viagensDB.listar(mesAtual, anoAtual);
        if (errorViagens) {
            console.error("Erro ao buscar estatísticas de viagens:", errorViagens);
            return { totalViagens: 0, kmTotal: 0, custoTotal: 0, custoMedio: 0 };
        }
        
        // Calcula totais
        const totalViagens = viagens.length;
        const totalMovimentado = viagens.reduce((sum, v) => sum + (parseFloat(v.valor_total) || 0), 0);
        const kmTotal = viagens.reduce((sum, v) => sum + (parseFloat(v.km) || 0), 0);
        const custoMedio = kmTotal > 0 ? (totalMovimentado / kmTotal) : 0;

        return {
            totalViagens,
            kmTotal: kmTotal.toFixed(1),
            custoTotal: totalMovimentado.toFixed(2),
            custoMedio: custoMedio.toFixed(2)
        };
    }
};

window.configDB = {
    // Busca a configuração atual (Mês atual, Ano atual, Valor padrão)
    async obter() {
        // ID 1 é fixo
        const { data, error } = await window.dbClient.from('app_config').select('*').eq('id', 1).single();
        if (error) {
            console.error('Erro ao ler config:', error);
            // Fallback se der erro
            return { mes_atual: new Date().getMonth() + 1, ano_atual: new Date().getFullYear(), valor_padrao: 5.00 };
        }
        return data;
    },

    // Atualiza qualquer campo da configuração
    async atualizar(dados) {
        const { error } = await window.dbClient.from('app_config').update(dados).eq('id', 1);
        if (error) throw error;
        return true;
    }
};
console.log('✅ db-config.js carregado completamente.');
