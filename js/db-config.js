// ============================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================

// Configuração do Supabase
const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

// Cliente do banco
let dbClient = null;
let supabase = null;

// Inicializar
(function() {
    if (!window.supabase || !window.supabase.createClient) {
        console.error('❌ Biblioteca Supabase não carregada');
        return;
    }
    
    try {
        dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);
        supabase = dbClient; // Exportar
        console.log('✅ Cliente criado');
    } catch (err) {
        console.error('❌ Erro:', err);
    }
})();

// Verificar conexão
async function verificarConexao() {
    if (!dbClient) {
        console.error('❌ Cliente não criado');
        return false;
    }
    
    try {
        const { error } = await dbClient.from('pessoas').select('count');
        if (error) throw error;
        console.log('✅ Conectado!');
        return true;
    } catch (err) {
        console.error('❌ Erro ao conectar:', err);
        
        if (err.code === '42P01' || (err.message && err.message.includes('relation'))) {
            console.error('');
            console.error('⚠️  TABELAS NÃO CRIADAS!');
            console.error('');
            console.error('Você precisa executar o SQL:');
            console.error('1. Acesse: https://supabase.com');
            console.error('2. SQL Editor → New Query');
            console.error('3. Cole o arquivo: supabase/schema.sql');
            console.error('4. Clique: RUN');
            console.error('');
        }
        
        return false;
    }
}

window.verificarConexao = verificarConexao;

// ============================================
// FUNÇÕES DE ACESSO AO BANCO
// ============================================

const pessoasDB = {
    async listar(apenasAtivos = true) {
        const query = dbClient.from('pessoas').select('*').order('nome');
        if (apenasAtivos) query.eq('ativo', true);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    async buscarPorId(id) {
        const { data, error } = await dbClient.from('pessoas').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
    },
    
    async criar(pessoa) {
        const { data, error } = await dbClient.from('pessoas').insert([pessoa]).select().single();
        if (error) throw error;
        return data;
    },
    
    async atualizar(id, pessoa) {
        const { data, error } = await dbClient.from('pessoas').update(pessoa).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    
    async excluir(id) {
        const { error } = await dbClient.from('pessoas').delete().eq('id', id);
        if (error) throw error;
    }
};

const viagensDB = {
    async listar(mes = null, ano = null) {
        let query = dbClient.from('vw_viagens_completas').select('*').order('data', { ascending: false });
        
        if (mes && ano) {
            const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
            const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];
            query = query.gte('data', dataInicio).lte('data', dataFim);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    async buscarPorId(id) {
        const { data: viagem, error: errorViagem } = await dbClient.from('viagens').select('*').eq('id', id).single();
        if (errorViagem) throw errorViagem;
        
        const { data: passageiros, error: errorPassageiros } = await dbClient.from('viagens_passageiros').select('*, pessoas(nome)').eq('viagem_id', id);
        if (errorPassageiros) throw errorPassageiros;
        
        return { ...viagem, passageiros };
    },
    
    async criar(viagem, passageiros) {
        const { data: viagemCriada, error: errorViagem } = await dbClient.from('viagens').insert([{
            data: viagem.data,
            motorista_id: viagem.motorista_id,
            valor_total: viagem.valor_total,
            observacao: viagem.observacao
        }]).select().single();
        
        if (errorViagem) throw errorViagem;
        
        if (passageiros.length > 0) {
            const passageirosData = passageiros.map(p => ({
                viagem_id: viagemCriada.id,
                passageiro_id: p.passageiro_id,
                valor_individual: p.valor_individual
            }));
            
            const { error: errorPassageiros } = await dbClient.from('viagens_passageiros').insert(passageirosData);
            if (errorPassageiros) throw errorPassageiros;
        }
        
        return viagemCriada;
    },
    
    async atualizar(id, viagem, passageiros) {
        const { data: viagemAtualizada, error: errorViagem } = await dbClient.from('viagens').update({
            data: viagem.data,
            motorista_id: viagem.motorista_id,
            valor_total: viagem.valor_total,
            observacao: viagem.observacao
        }).eq('id', id).select().single();
        
        if (errorViagem) throw errorViagem;
        
        await dbClient.from('viagens_passageiros').delete().eq('viagem_id', id);
        
        if (passageiros.length > 0) {
            const passageirosData = passageiros.map(p => ({
                viagem_id: id,
                passageiro_id: p.passageiro_id,
                valor_individual: p.valor_individual
            }));
            
            const { error: errorPassageiros } = await dbClient.from('viagens_passageiros').insert(passageirosData);
            if (errorPassageiros) throw errorPassageiros;
        }
        
        return viagemAtualizada;
    },
    
    async excluir(id) {
        const { error } = await dbClient.from('viagens').delete().eq('id', id);
        if (error) throw error;
    }
};

const saldosDB = {
    async listarAtuais() {
        const { data, error } = await dbClient.from('vw_saldos_atuais').select('*').order('saldo', { ascending: false });
        if (error) throw error;
        return data;
    },
    
    async calcularPorPeriodo(pessoaId, dataInicio, dataFim) {
        const { data, error } = await dbClient.rpc('calcular_saldo_pessoa', {
            p_pessoa_id: pessoaId,
            p_data_inicio: dataInicio,
            p_data_fim: dataFim
        });
        if (error) throw error;
        return data;
    }
};

const fechamentosDB = {
    async listar() {
        const { data, error } = await dbClient.from('fechamentos_mensais').select('*, fechamentos_saldos(*, pessoas(nome))').order('ano', { ascending: false }).order('mes', { ascending: false });
        if (error) throw error;
        return data;
    },
    
    async buscarPorMesAno(mes, ano) {
        const { data, error } = await dbClient.from('fechamentos_mensais').select('*, fechamentos_saldos(*, pessoas(nome))').eq('mes', mes).eq('ano', ano).single();
        
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    },
    
    async realizar(mes, ano) {
        const { data, error } = await dbClient.rpc('realizar_fechamento_mensal', {
            p_mes: mes,
            p_ano: ano
        });
        if (error) throw error;
        return data;
    }
};

const estatisticasDB = {
    async obterDashboard(mes = null, ano = null) {
        const mesAtual = mes || new Date().getMonth() + 1;
        const anoAtual = ano || new Date().getFullYear();
        
        const { data: viagens, error: errorViagens } = await viagensDB.listar(mesAtual, anoAtual);
        if (errorViagens) throw errorViagens;
        
        const totalMovimentado = viagens.reduce((sum, v) => sum + parseFloat(v.valor_total), 0);
        
        const { data: pessoas, error: errorPessoas } = await pessoasDB.listar(true);
        if (errorPessoas) throw errorPessoas;
        
        const { data: saldos, error: errorSaldos } = await saldosDB.listarAtuais();
        if (errorSaldos) throw errorSaldos;
        
        return {
            totalViagens: viagens.length,
            totalMovimentado: totalMovimentado,
            pessoasAtivas: pessoas.length,
            saldos: saldos,
            viagens: viagens
        };
    }
};
