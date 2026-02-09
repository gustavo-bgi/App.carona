const appState = {
    config: {}, filtroMes: 0, filtroAno: 0,
    pessoas: [], viagens: [], saldos: [],
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

document.addEventListener('DOMContentLoaded', async () => {
    appState.config = await window.configDB.obter();
    appState.filtroMes = appState.config.mes_atual;
    appState.filtroAno = appState.config.ano_atual;
    configurarEventos();
    await carregarDados();
});

async function carregarDados() {
    mostrarLoading(true);
    const [{data: p}, {data: v}, {data: s}] = await Promise.all([
        window.pessoasDB.listar(),
        window.viagensDB.listar(appState.filtroMes, appState.filtroAno),
        window.saldosDB.listarAtuais()
    ]);
    appState.pessoas = p || [];
    appState.viagens = v || [];
    appState.saldos = s || [];
    renderizar();
    mostrarLoading(false);
}

function renderizar() {
    // Dashboard Simplificado (Apenas Número de Viagens)
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    
    // Tabela de Saldos (Cálculo Automático)
    const tbP = document.querySelector('#tabelaPessoas tbody');
    tbP.innerHTML = '';
    appState.saldos.filter(x => x.ativo || appState.isAdmin).forEach(s => {
        const tr = document.createElement('tr');
        const classeSaldo = s.saldo_liquido >= 0 ? 'text-success' : 'text-danger';
        tr.innerHTML = `
            <td>${s.nome}</td>
            <td class="text-danger">${fmtMoeda(s.a_pagar)}</td>
            <td class="text-success">${fmtMoeda(s.a_receber)}</td>
            <td class="${classeSaldo} font-bold">${fmtMoeda(s.saldo_liquido)}</td>
        `;
        tbP.appendChild(tr);
    });

    // Seletor de Meses (Apenas histórico e o mês aberto)
    popularSelectMeses();
}

function popularSelectMeses() {
    const sel = document.getElementById('mesSelecionado');
    sel.innerHTML = '';
    let m = appState.config.mes_atual, a = appState.config.ano_atual;
    for(let i=0; i<6; i++) { // Mostra o atual + 5 meses passados
        const opt = new Option(`${String(m).padStart(2,'0')}/${a} ${i===0?'(Aberto)':''}`, `${m}-${a}`);
        sel.add(opt);
        if(--m < 1) { m=12; a--; }
    }
}

async function fecharMes() {
    if(!confirm("Fechar mês e cobrar saldos?")) return;
    let nM = appState.config.mes_atual + 1, nA = appState.config.ano_atual;
    if(nM > 12) { nM = 1; nA++; }
    await window.configDB.atualizar({ mes_atual: nM, ano_atual: nA });
    location.reload();
}

function configurarEventos() {
    document.getElementById('btnFecharMes').onclick = fecharMes;
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m); appState.filtroAno = parseInt(a);
        carregarDados();
    };
}

const fmtMoeda = (v) => parseFloat(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const mostrarLoading = (s) => document.getElementById('loadingOverlay').classList.toggle('hidden', !s);
