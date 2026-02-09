// ============================================
// CONFIGURAÇÃO DO BANCO DE DADOS (GLOBAL)
// ============================================

const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

// Inicializa e joga direto no WINDOW para ficar visível
if (window.supabase && window.supabase.createClient) {
    window.dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);
    console.log('✅ Cliente Supabase carregado no window.dbClient');
} else {
    console.error('❌ Biblioteca Supabase não encontrada!');
}

// ---------------------------------------------------------
// FUNÇÕES EXPORTADAS PARA O WINDOW (GLOBAL)
// ---------------------------------------------------------

window.verificarConexao = async function() {
    if (!window.dbClient) return false;
    try {
        // Teste simples para ver se conecta
        const { error } = await window.dbClient.from('pessoas').select('count', { count: 'exact', head: true });
        if (error && error.code !== 'PGRST116') { // Ignora erro de "tabela vazia" se for o caso
            console.error('Erro de conexão:', error);
            // return false; // Descomente se quiser ser rígido
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

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

window.viagensDB = {
    async listar(mes, ano) {
        // Cria datas ajustadas para o filtro
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0];

        // Busca viagens com relacionamentos
        return await window.dbClient
            .from('viagens')
            .select('*, motorista:pessoas!motorista_id(nome), passageiros:viagens_passageiros(pessoa_id, valor, pago, pessoa:pessoas(nome))')
            .gte('data', inicio)
            .lte('data', fim)
            .order('data', { ascending: false });
    },
    async criar(viagem, passageiros) {
        // 1. Cria a viagem
        const { data: v, error } = await window.dbClient.from('viagens').insert([viagem]).select().single();
        if (error) throw error;

        // 2. Cria os passageiros
        if (passageiros && passageiros.length > 0) {
            const passData = passageiros.map(p => ({
                viagem_id: v.id,
                pessoa_id: p.pessoa_id, // Atenção aqui: o JS manda 'pessoa_id'
                valor: p.valor,         // Atenção aqui: o JS manda 'valor'
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

window.saldosDB = {
    async listarAtuais() {
        return await window.dbClient.from('saldos_atuais_view').select('*');
    }
};

window.fechamentoDB = {
    async verificar(mes, ano) { return { data: null }; /* Simplificado */ }
};
