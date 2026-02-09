const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

const dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);

window.configDB = {
    async obter() {
        const { data } = await dbClient.from('app_config').select('*').eq('id', 1).single();
        return data;
    },
    async atualizar(dados) {
        return await dbClient.from('app_config').update(dados).eq('id', 1);
    }
};

window.pessoasDB = {
    async listar() { return await dbClient.from('pessoas').select('*').order('nome'); },
    async criar(dados) { return await dbClient.from('pessoas').insert(dados); },
    async atualizar(id, dados) { return await dbClient.from('pessoas').update(dados).eq('id', id); }
};

window.viagensDB = {
    async listar(mes, ano) {
        const i = `${ano}-${String(mes).padStart(2,'0')}-01`;
        let pM = parseInt(mes) + 1; let pA = ano;
        if (pM > 12) { pM = 1; pA++; }
        const f = `${pA}-${String(pM).padStart(2,'0')}-01`;
        return await dbClient.from('viagens')
            .select('*, motorista:pessoas!motorista_id(nome), passageiros:viagens_passageiros(pessoa_id, valor, pessoa:pessoas(nome))')
            .gte('data', i).lt('data', f).order('data', {ascending: false});
    },
    async criar(viagem, passageiros) {
        const { data: v, error: ev } = await dbClient.from('viagens').insert(viagem).select().single();
        if(ev) throw ev;
        const passFinal = passageiros.map(p => ({ ...p, viagem_id: v.id }));
        return await dbClient.from('viagens_passageiros').insert(passFinal);
    },
    async atualizar(id, viagem, passageiros) {
        const { error: ev } = await dbClient.from('viagens').update(viagem).eq('id', id);
        if(ev) throw ev;
        await dbClient.from('viagens_passageiros').delete().eq('viagem_id', id);
        const passFinal = passageiros.map(p => ({ ...p, viagem_id: id }));
        return await dbClient.from('viagens_passageiros').insert(passFinal);
    },
    async excluir(id) { return await dbClient.from('viagens').delete().eq('id', id); }
};

window.saldosDB = {
    async listarAtuais() { return await dbClient.from('saldos_atuais_view').select('*'); }
};

window.verificarConexao = async () => {
    const { error } = await dbClient.from('app_config').select('id').limit(1);
    return !error;
};
