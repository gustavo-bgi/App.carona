const appState = {
    config: { mes_atual: 2, ano_atual: 2026, valor_padrao: 5 },
    filtroMes: 2, filtroAno: 2026,
    pessoas: [], viagens: [], saldos: [],
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carregar Configuração do Sistema
    try {
        const conf = await window.configDB.obter();
        if(conf) appState.config = conf;
        
        appState.filtroMes = appState.config.mes_atual;
        appState.filtroAno = appState.config.ano_atual;
    } catch(e) { console.error("Erro config", e); }

    configurarInterface();
    await carregarDados();
});

async function carregarDados() {
    mostrarLoading(true);
    try {
        const { data: p } = await window.pessoasDB.listar();
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno);
        const { data: s } = await window.saldosDB.listarAtuais();
        
        appState.pessoas = p || [];
        appState.viagens = v || [];
        appState.saldos = s || [];
        
        renderizar();
    } catch(e) { console.error(e); }
    finally { mostrarLoading(false); }
}

function renderizar() {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    document.getElementById('labelMes').innerText = `${meses[appState.filtroMes-1]}/${appState.filtroAno}`;
    document.getElementById('totalViagens').innerText = appState.viagens.length;

    // Tabela Saldos
    const tbS = document.querySelector('#tabelaPessoas tbody');
    tbS.innerHTML = '';
    appState.saldos.filter(x => x.ativo || appState.isAdmin).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.nome}</td>
            <td class="text-right text-danger">${fmtMoeda(s.a_pagar)}</td>
            <td class="text-right text-success">${fmtMoeda(s.a_receber)}</td>
            <td class="text-right font-bold ${s.saldo_liquido >= 0 ? 'text-success' : 'text-danger'}">${fmtMoeda(s.saldo_liquido)}</td>
        `;
        tbS.appendChild(tr);
    });

    // Tabela Viagens
    const tbV = document.querySelector('#tabelaViagens tbody');
    tbV.innerHTML = '';
    appState.viagens.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</td>
            <td>${v.motorista?.nome || '?'}</td>
            <td class="text-right">${fmtMoeda(v.valor_total)}</td>
            <td class="admin-only"><button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button></td>
        `;
        tbV.appendChild(tr);
    });

    popularSelectMeses();
    document.body.classList.toggle('modo-admin-ativo', appState.isAdmin);
}

function configurarInterface() {
    // Corrigido: Botão de Viagem
    const btnViagem = document.getElementById('btnNovaViagemLink');
    if(btnViagem) btnViagem.onclick = () => window.abrirModalViagem();

    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        renderizar();
    };

    document.getElementById('btnFecharMes').onclick = fecharMes;

    document.getElementById('btnSalvarViagem').onclick = salvarViagem;
    
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m);
        appState.filtroAno = parseInt(a);
        carregarDados();
    };

    // Fechar modais
    document.querySelectorAll('.modal-close, [data-modal]').forEach(b => {
        b.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    });
}

function popularSelectMeses() {
    const sel = document.getElementById('mesSelecionado');
    const atual = `${appState.filtroMes}-${appState.filtroAno}`;
    sel.innerHTML = '';
    
    let m = appState.config.mes_atual, a = appState.config.ano_atual;
    for(let i=0; i<6; i++) {
        // Bloqueia qualquer mês anterior a Fevereiro/2026
        if(a < 2026 || (a === 2026 && m < 2)) break;
        
        const opt = new Option(`${String(m).padStart(2,'0')}/${a} ${i===0?'(Aberto)':''}`, `${m}-${a}`);
        sel.add(opt);
        if(--m < 1) { m=12; a--; }
    }
    sel.value = atual;
}

window.abrirModalViagem = (id = null) => {
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemValorUnit').value = appState.config.valor_padrao;
    
    const selMot = document.getElementById('viagemMotorista');
    selMot.innerHTML = '<option value="">Selecione...</option>';
    appState.pessoas.filter(p=>p.ativo).forEach(p => selMot.add(new Option(p.nome, p.id)));

    const divPass = document.getElementById('listaPassageiros');
    divPass.innerHTML = '';
    appState.pessoas.filter(p=>p.ativo).forEach(p => {
        divPass.innerHTML += `<label style="display:block;"><input type="checkbox" class="chk-pass" value="${p.id}"> ${p.nome}</label>`;
    });

    document.getElementById('modalViagem').classList.remove('hidden');
};

async function salvarViagem() {
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const valorUnit = parseFloat(document.getElementById('viagemValorUnit').value);
    const checks = document.querySelectorAll('.chk-pass:checked');

    if(!data || !motorista_id || !valorUnit || checks.length === 0) return alert('Preencha tudo!');

    const dados = { data, motorista_id, valor_total: valorUnit * checks.length };
    const passageiros = Array.from(checks).map(c => ({ pessoa_id: c.value, valor: valorUnit, pago: false }));

    try {
        await window.viagensDB.criar(dados, passageiros);
        document.getElementById('modalViagem').classList.add('hidden');
        await carregarDados();
    } catch(e) { alert("Erro ao salvar"); }
}

async function fecharMes() {
    if(!confirm("Encerrar este mês?")) return;
    let nM = appState.config.mes_atual + 1, nA = appState.config.ano_atual;
    if(nM > 12) { nM = 1; nA++; }
    await window.configDB.atualizar({ mes_atual: nM, ano_atual: nA });
    location.reload();
}

window.excluirViagem = async (id) => {
    if(confirm('Excluir?')) { await window.viagensDB.excluir(id); await carregarDados(); }
};

const fmtMoeda = (v) => parseFloat(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const mostrarLoading = (s) => document.getElementById('loadingOverlay').classList.toggle('hidden', !s);
    
