// ============================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================

// IMPORTANTE: Substitua estas credenciais pelas suas!
// 1. Acesse: https://supabase.com
// 2. Crie um novo projeto
// 3. Vá em Settings > API
// 4. Copie a URL e a anon key

const SUPABASE_URL = 'SEU_SUPABASE_URL_AQUI'; // Ex: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY_AQUI';

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verificar conexão
async function verificarConexao() {
    try {
        const { data, error } = await supabase.from('pessoas').select('count');
        if (error) throw error;
        console.log('✅ Conectado ao Supabase com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar ao Supabase:', error);
        
        // Mostrar alerta para o usuário
        if (SUPABASE_URL === 'SEU_SUPABASE_URL_AQUI') {
            alert(
                '⚠️ CONFIGURAÇÃO NECESSÁRIA\n\n' +
                'Por favor, configure suas credenciais do Supabase no arquivo js/supabase.js\n\n' +
                '1. Acesse https://supabase.com\n' +
                '2. Crie um novo projeto\n' +
                '3. Execute o script SQL em supabase/schema.sql\n' +
                '4. Copie suas credenciais para js/supabase.js'
            );
        }
        return false;
    }
}

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
