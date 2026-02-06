// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================

// CREDENCIAIS DO SUPABASE
const SUPABASE_CONFIG = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'sb_publishable_x5Yh7ZshxCbGDAj39j4GMQ_KBs71WYm'
};

// Criar cliente Supabase
let dbClient = null;

(function initSupabase() {
    if (!window.supabase) {
        console.error('❌ Biblioteca Supabase não carregada');
        return;
    }
    
    try {
        dbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        console.log('✅ Cliente Supabase criado');
    } catch (error) {
        console.error('❌ Erro ao criar cliente:', error);
    }
})();

// Exportar cliente
const supabase = dbClient;

// Verificar conexão
async function verificarConexao() {
    // Verificar se cliente foi criado
    if (!dbClient) {
        console.error('❌ Cliente Supabase não foi criado');
        return false;
    }
    
    try {
        const { data, error } = await dbClient.from('pessoas').select('count');
        if (error) throw error;
        console.log('✅ Conectado ao Supabase com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar ao Supabase:', error);
        
        // Mensagem específica baseada no erro
        if (error.message && error.message.includes('Failed to fetch')) {
            console.error('Possível problema: URL do Supabase incorreta ou projeto inativo');
        } else if (error.message && error.message.includes('JWT')) {
            console.error('Possível problema: Chave anon incorreta');
        } else if (error.code === '42P01') {
            console.error('⚠️ IMPORTANTE: Tabelas não criadas. Você precisa executar o schema.sql no Supabase!');
            console.error('📋 Passo a passo:');
            console.error('1. Vá no Supabase → SQL Editor');
            console.error('2. Clique em "New Query"');
            console.error('3. Cole o conteúdo do arquivo supabase/schema.sql');
            console.error('4. Clique em "Run"');
        }
        
        return false;
    }
}

// Exportar para o escopo global
window.verificarConexao = verificarConexao;

// ============================================
// FUNÇÕES DE ACESSO AO BANCO
// ============================================

// PESSOAS
const pessoasDB = {
    async listar(apenasAtivos = true) {
        const query = supabase
            .from('pessoas')
            .select('*')
            .order('nome');
        
        if (apenasAtivos) {
            query.eq('ativo', true);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    async buscarPorId(id) {
        const { data, error } = await supabase
            .from('pessoas')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async criar(pessoa) {
        const { data, error } = await supabase
            .from('pessoas')
            .insert([pessoa])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async atualizar(id, pessoa) {
        const { data, error } = await supabase
            .from('pessoas')
            .update(pessoa)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async excluir(id) {
        const { error } = await supabase
            .from('pessoas')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// VIAGENS
const viagensDB = {
    async listar(mes = null, ano = null) {
        let query = supabase
            .from('vw_viagens_completas')
            .select('*')
            .order('data', { ascending: false });
        
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
        const { data: viagem, error: errorViagem } = await supabase
            .from('viagens')
            .select('*')
            .eq('id', id)
            .single();
        
        if (errorViagem) throw errorViagem;
        
        const { data: passageiros, error: errorPassageiros } = await supabase
            .from('viagens_passageiros')
            .select('*, pessoas(nome)')
            .eq('viagem_id', id);
        
        if (errorPassageiros) throw errorPassageiros;
        
        return { ...viagem, passageiros };
    },
    
    async criar(viagem, passageiros) {
        // Inserir viagem
        const { data: viagemCriada, error: errorViagem } = await supabase
            .from('viagens')
            .insert([{
                data: viagem.data,
                motorista_id: viagem.motorista_id,
                valor_total: viagem.valor_total,
                observacao: viagem.observacao
            }])
            .select()
            .single();
        
        if (errorViagem) throw errorViagem;
        
        // Inserir passageiros
        if (passageiros.length > 0) {
            const passageirosData = passageiros.map(p => ({
                viagem_id: viagemCriada.id,
                passageiro_id: p.passageiro_id,
                valor_individual: p.valor_individual
            }));
            
            const { error: errorPassageiros } = await supabase
                .from('viagens_passageiros')
                .insert(passageirosData);
            
            if (errorPassageiros) throw errorPassageiros;
        }
        
        return viagemCriada;
    },
    
    async atualizar(id, viagem, passageiros) {
        // Atualizar viagem
        const { data: viagemAtualizada, error: errorViagem } = await supabase
            .from('viagens')
            .update({
                data: viagem.data,
                motorista_id: viagem.motorista_id,
                valor_total: viagem.valor_total,
                observacao: viagem.observacao
            })
            .eq('id', id)
            .select()
            .single();
        
        if (errorViagem) throw errorViagem;
        
        // Deletar passageiros antigos
        const { error: errorDelete } = await supabase
            .from('viagens_passageiros')
            .delete()
            .eq('viagem_id', id);
        
        if (errorDelete) throw errorDelete;
        
        // Inserir novos passageiros
        if (passageiros.length > 0) {
            const passageirosData = passageiros.map(p => ({
                viagem_id: id,
                passageiro_id: p.passageiro_id,
                valor_individual: p.valor_individual
            }));
            
            const { error: errorPassageiros } = await supabase
                .from('viagens_passageiros')
                .insert(passageirosData);
            
            if (errorPassageiros) throw errorPassageiros;
        }
        
        return viagemAtualizada;
    },
    
    async excluir(id) {
        const { error } = await supabase
            .from('viagens')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
    }
};

// SALDOS
const saldosDB = {
    async listarAtuais() {
        const { data, error } = await supabase
            .from('vw_saldos_atuais')
            .select('*')
            .order('saldo', { ascending: false });
        
        if (error) throw error;
        return data;
    },
    
    async calcularPorPeriodo(pessoaId, dataInicio, dataFim) {
        const { data, error } = await supabase
            .rpc('calcular_saldo_pessoa', {
                p_pessoa_id: pessoaId,
                p_data_inicio: dataInicio,
                p_data_fim: dataFim
            });
        
        if (error) throw error;
        return data;
    }
};

// FECHAMENTOS
const fechamentosDB = {
    async listar() {
        const { data, error } = await supabase
            .from('fechamentos_mensais')
            .select('*, fechamentos_saldos(*, pessoas(nome))')
            .order('ano', { ascending: false })
            .order('mes', { ascending: false });
        
        if (error) throw error;
        return data;
    },
    
    async buscarPorMesAno(mes, ano) {
        const { data, error } = await supabase
            .from('fechamentos_mensais')
            .select('*, fechamentos_saldos(*, pessoas(nome))')
            .eq('mes', mes)
            .eq('ano', ano)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') return null; // Não encontrado
            throw error;
        }
        return data;
    },
    
    async realizar(mes, ano) {
        const { data, error } = await supabase
            .rpc('realizar_fechamento_mensal', {
                p_mes: mes,
                p_ano: ano
            });
        
        if (error) throw error;
        return data;
    }
};

// ESTATÍSTICAS
const estatisticasDB = {
    async obterDashboard(mes = null, ano = null) {
        const mesAtual = mes || new Date().getMonth() + 1;
        const anoAtual = ano || new Date().getFullYear();
        
        // Total de viagens
        const { data: viagens, error: errorViagens } = await viagensDB.listar(mesAtual, anoAtual);
        if (errorViagens) throw errorViagens;
        
        // Total movimentado
        const totalMovimentado = viagens.reduce((sum, v) => sum + parseFloat(v.valor_total), 0);
        
        // Pessoas ativas
        const { data: pessoas, error: errorPessoas } = await pessoasDB.listar(true);
        if (errorPessoas) throw errorPessoas;
        
        // Saldos
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
