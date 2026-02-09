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
    // Verifica se a biblioteca foi carregada antes de tentar usar
    if (!window.supabase || !window.supabase.createClient) {
        console.error('❌ Biblioteca Supabase não carregada. Verifique o <script> no HTML.');
        return;
    }
    
    try {
        dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);
        supabase = dbClient; 
        console.log('✅ Cliente Supabase criado com sucesso');
    } catch (err) {
        console.error('❌ Erro ao criar cliente Supabase:', err);
    }
})();

// Verificar conexão
async function verificarConexao() {
    if (!dbClient) {
        console.error('❌ Cliente Supabase não inicializado');
        return false;
    }
    
    try {
        const { data, error } = await dbClient.from('pessoas').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Erro de conexão:', error);
            return false;
        }
        
        console.log('✅ Conexão com Supabase verificada');
        return true;
    } catch (err) {
        console.error('❌ Erro inesperado na verificação:', err);
        return false;
    }
}

// ============================================
// MÓDULOS DE DADOS
// ============================================

const pessoasDB = {
    async listar(ativosApenas = false) {
        let query = dbClient.from('pessoas').select('*').order('nome');
        
        if (ativosApenas) {
            query = query.eq('ativo', true);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { data, error };
    },
    
    async obter(id) {
        const { data, error } = await dbClient.from('pessoas').select('*').eq('id', id).single();
        if (error) throw error;
        return { data, error };
    },
    
    async criar(pessoa) {
        const { data, error } = await dbClient.from('pessoas').insert([pessoa]).select();
        if (error) throw error;
        return { data, error };
    },
    
    async atualizar(id, dados) {
        const { data, error } = await dbClient.from('pessoas').update(dados).eq('id', id).select();
        if (error) throw error;
        return { data, error };
    },
    
    async excluir(id) {
        const { error } = await dbClient.from('pessoas').delete().eq('id', id);
        if (error) throw error;
        return { error };
    }
};

const viagensDB = {
    async listar(mes, ano) {
        // Filtrar por mês e ano
        // Assumindo que existe uma coluna 'data' do tipo date
        const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
        // Para pegar o último dia do mês, avançamos para o próximo mês e voltamos um dia
        const dataFim = new Date(ano, mes, 0).toISOString().split('T')[0];
        
        const { data, error } = await dbClient
            .from('viagens')
            .select(`
                *,
                motorista:pessoas!motorista_id(nome),
                passageiros:viagens_passageiros(
                    pessoa_id,
                    valor,
                    pago,
                    pessoa:pessoas(nome)
                )
            `)
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: false });
            
        if (error) throw error;
        return { data, error };
    },
    
    async criar(viagem, passageiros) {
        // 1. Criar viagem
        const { data: novaViagem, error: erroViagem } = await dbClient
            .from('viagens')
            .insert([viagem])
            .select()
            .single();
            
        if (erroViagem) throw erroViagem;
        
        // 2. Adicionar passageiros
        if (passageiros && passageiros.length > 0) {
            const passageirosDados = passageiros.map(p => ({
                viagem_id: novaViagem.id,
                pessoa_id: p.pessoa_id,
                valor: p.valor,
                pago: p.pago || false
            }));
            
            const { error: erroPassageiros } = await dbClient
                .from('viagens_passageiros')
                .insert(passageirosDados);
                
            if (erroPassageiros) {
                // Tentar reverter a viagem se falhar nos passageiros (manual rollback)
                await dbClient.from('viagens').delete().eq('id', novaViagem.id);
                throw erroPassageiros;
            }
        }
        
        return { data: novaViagem };
    },
    
    async atualizar(id, viagem, passageiros) {
        // 1. Atualizar dados da viagem
        const { error: erroViagem } = await dbClient
            .from('viagens')
            .update(viagem)
            .eq('id', id);
            
        if (erroViagem) throw erroViagem;
        
        // 2. Atualizar passageiros (estratégia: remover todos e recriar)
        if (passageiros) {
            // Remover atuais
            const { error: erroRemocao } = await dbClient
                .from('viagens_passageiros')
                .delete()
                .eq('viagem_id', id);
                
            if (erroRemocao) throw erroRemocao;
            
            // Inserir novos
            if (passageiros.length > 0) {
                const passageirosDados = passageiros.map(p => ({
                    viagem_id: id,
                    pessoa_id: p.pessoa_id,
                    valor: p.valor,
                    pago: p.pago || false
                }));
                
                const { error: erroInsercao } = await dbClient
                    .from('viagens_passageiros')
                    .insert(passageirosDados);
                    
                if (erroInsercao) throw erroInsercao;
            }
        }
        
        return { data: { id, ...viagem } };
    },
    
    async excluir(id) {
        // Devido ao "on delete cascade" configurado no banco (geralmente),
        // excluir a viagem deve excluir os passageiros automaticamente.
        const { error } = await dbClient.from('viagens').delete().eq('id', id);
        if (error) throw error;
        return { error };
    }
};

const saldosDB = {
    async listarAtuais() {
        // Esta função pode ser uma view no banco ou cálculo em tempo real
        // Aqui simulamos buscando de uma tabela de saldos ou view
        const { data, error } = await dbClient.from('saldos_atuais_view').select('*');
        
        if (error) {
            // Fallback se a view não existir: calcular na mão (simplificado)
            // Na prática, ideal é ter uma View SQL criada no Supabase
            console.warn('View de saldos não encontrada, retornando vazio', error);
            return { data: [], error: null };
        }
        
        return { data, error };
    },
    
    async registrarPagamento(pagamento) {
        const { data, error } = await dbClient.from('pagamentos').insert([pagamento]).select();
        if (error) throw error;
        return { data, error };
    }
};

const fechamentoDB = {
    async verificar(mes, ano) {
        const { data, error } = await dbClient
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
        // Chama uma função RPC (Remote Procedure Call) no banco
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
        // Implementação simplificada
        return {
            totalViagens: 0,
            kmTotal: 0,
            custoMedio: 0
        };
    }
};

// ============================================
// EXPORTAR PARA O ESCOPO GLOBAL (WINDOW)
// ============================================
// Isso é CRUCIAL para que o app.js consiga acessar estas funções
window.dbClient = dbClient;
window.supabase = supabase;
window.verificarConexao = verificarConexao;
window.pessoasDB = pessoasDB;
window.viagensDB = viagensDB;
window.saldosDB = saldosDB;
window.fechamentoDB = fechamentoDB;
window.estatisticasDB = estatisticasDB;
