const dbConfig = {
    url: 'https://mlftdhglevxgpfeyjtnl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZnRkaGdsZXZ4Z3BmZXlqdG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTMyNjgsImV4cCI6MjA4NTkyOTI2OH0.SmL5tUpE_zlqzyPlcQqTys7CTzhNnJGjRfWLQqN75lA'
};

if (window.supabase) window.dbClient = window.supabase.createClient(dbConfig.url, dbConfig.key);

window.verificarConexao = async function() {
    if (!window.dbClient) return false;
    const { error } = await window.dbClient.from('pessoas').select('count', { count: 'exact', head: true });
    return !error || error.code === 'PGRST116';
};

window.configDB = {
    async obter() {
        const { data, error } = await window.dbClient.from('app_config').select('*').eq('id', 1).single();
        if (error || !data) return { mes_atual: new Date().getMonth()+1, ano_atual: new Date().getFullYear(), valor_padrao: 5.00 };
        return data;
    },
    async atualizar(dados) { await window.dbClient.from('app_config').update(dados).eq('id', 1); }
};

window.pessoasDB = {
    async listar() { return await window.dbClient.from('pessoas').select('*').order('nome'); },
    async criar(d) { return await window.dbClient.from('pessoas').insert([d]); },
    async atualizar(id, d) { return await window.dbClient.from('pessoas').update(d).eq('id', id); }
};

window.viagensDB = {
    async listar(m, a) {
        const i = `${a}-${String(m).padStart(2,'0')}-01`, f = new Date(a, m, 0).toISOString().split('T')[0];
        return await window.dbClient.from('viagens')
            .select('*, motorista:pessoas!motorista_id(nome), passageiros:viagens_passageiros(pessoa_id, valor, pago, pessoa:pessoas(nome))')
            .gte('data', i).lte('data', f).order('data', {ascending:false});
    },
    async criar(v, pass) {
        const {data:via, error} = await window.dbClient.from('viagens').insert([v]).select().single();
        if(error) throw error;
        if(pass.length) await window.dbClient.from('viagens_passageiros').insert(pass.map(p=>({...p, viagem_id: via.id})));
    },
    async atualizar(id, v, pass) {
        await window.dbClient.from('viagens').update(v).eq('id', id);
        await window.dbClient.from('viagens_passageiros').delete().eq('viagem_id', id);
        if(pass.length) await window.dbClient.from('viagens_passageiros').insert(pass.map(p=>({...p, viagem_id: id})));
    },
    async excluir(id) { return await window.dbClient.from('viagens').delete().eq('id', id); }
};

window.saldosDB = {
    async listarAtuais() { return await window.dbClient.from('saldos_atuais_view').select('*'); }
};
