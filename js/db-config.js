// ============================================
// CONFIGURAÇÃO DE ACESSO AO SUPABASE
// ============================================
const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

// Inicializa o cliente Supabase (Certifique-se que o script do Supabase está no HTML antes deste)
const dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);

// ============================================
// MÓDULO DE CONFIGURAÇÕES (ADMIN)
// ============================================
window.configDB = {
    // Busca Mês Aberto, Ano e Valor Padrão
    async obter() {
        const { data, error } = await dbClient.from('app_config').select('*').eq('id', 1).single();
        if (error) {
            console.error("Erro ao buscar config:", error);
            return { mes_atual: 2, ano_atual: 2026, valor_padrao: 5 }; // Fallback
        }
        return data;
    },
    // Atualiza o valor padrão ou o mês do sistema
    async atualizar(dados) {
        const { data, error } = await dbClient.from('app_config').update(dados).eq('id', 1);
        if (error) throw error;
        return data;
    }
};

// ============================================
// MÓDULO DE PESSOAS (USUÁRIOS)
// ============================================
window.pessoasDB = {
    async listar() {
        const { data, error } = await dbClient.from('pessoas').select('*').order('nome');
        if (error) throw error;
        return { data };
    },
    async criar(dados) {
        return await dbClient.from('pessoas').insert(dados);
    },
    async atualizar(id, dados) {
        return await dbClient.from('app_config').update(dados).eq('id', id);
    }
};

// ============================================
// MÓDULO DE VIAGENS (LANÇAMENTOS)
// ============================================
window.viagensDB = {
    async listar(mes, ano) {
        // Lógica de Datas: Busca do dia 1 do mês selecionado 
        // até o dia 1 do PRÓXIMO mês (exclusivo)
        const i = `${ano}-${String(mes).padStart(2, '0')}-01`;
        
        let proximoMes = parseInt(mes) + 1;
        let proximoAno = ano;
        if (proximoMes > 12) {
            proximoMes = 1;
            proximoAno++;
        }
        const f = `${proximoAno}-${String(proximoMes).padStart(2, '0')}-01`;

        console.log(`🔍 Consultando banco: Viagens entre ${i} e ${f}`);

        const { data, error } = await dbClient.from('viagens')
            .select(`
                *,
                motorista:pessoas!motorista_id(nome),
                passageiros:viagens_passageiros(
                    pessoa_id, 
                    valor, 
                    pessoa:pessoas(nome)
                )
            `)
            .gte('data', i)
            .lt('data', f) // Menor que o início do mês seguinte
            .order('data', { ascending: false });

        if (error) {
            console.error("Erro ao listar viagens:", error);
            throw error;
        }
        return { data };
    },

    async criar(viagem, passageiros) {
        // 1. Insere a viagem
        const { data: v, error: ev } = await dbClient.from('viagens').insert(viagem).select().single();
        if (ev) throw ev;

        // 2. Vincula os passageiros ao ID gerado
        const passFinal = passageiros.map(p => ({
            ...p,
            viagem_id: v.id
        }));

        const { error: ep } = await dbClient.from('viagens_passageiros').insert(passFinal);
        if (ep) throw ep;

        return { data: v };
    },

    async excluir(id) {
        return await dbClient.from('viagens').delete().eq('id', id);
    }
};

// ============================================
// MÓDULO DE SALDOS (VIEW DO BANCO)
// ============================================
window.saldosDB = {
    // Busca o saldo bruto (histórico) que será filtrado pelo app.js em tela
    async listarAtuais() {
        const { data, error } = await dbClient.from('saldos_atuais_view').select('*');
        if (error) throw error;
        return { data };
    }
};

// ============================================
// UTILITÁRIO DE CONEXÃO
// ============================================
window.verificarConexao = async () => {
    try {
        const { error } = await dbClient.from('app_config').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
};

console.log('✅ db-config.js carregado com sucesso.');
