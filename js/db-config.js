const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

let dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);

window.configDB = {
    async obter() {
        const { data } = await dbClient.from('app_config').select('*').eq('id', 1).single();
        return data;
    },
    async atualizar(dados) {
        await dbClient.from('app_config').update(dados).eq('id', 1);
    }
};

window.pessoasDB = {
    async listar() { return await dbClient.from('pessoas').select('*').order('nome'); },
    async atualizar(id, dados) { await dbClient.from('pessoas').update(dados).eq('id', id); }
};

window.viagensDB = {
    async listar(mes, ano) {
        // Filtra viagens pelo mês e ano de referência
        const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
        const dataFim = `${ano}-${String(mes).padStart(2,'0')}-31`;
        return await dbClient.from('viagens')
            .select('*, motorista:pessoas!motorista_id(nome), passageiros:viagens_passageiros(valor, pessoa:pessoas(nome))')
            .gte('data', dataInicio).lte('data', dataFim).order('data', {ascending: false});
    },
    async criar(viagem, passageiros) {
        const { data: v } = await dbClient.from('viagens').insert(viagem).select().single();
        const logs = passageiros.map(p => ({ ...p, viagem_id: v.id }));
        await dbClient.from('viagens_passageiros').insert(logs);
    },
    async excluir(id) { await dbClient.from('viagens').delete().eq('id', id); }
};

window.saldosDB = {
    async listarAtuais() { return await dbClient.from('saldos_atuais_view').select('*'); }
};
