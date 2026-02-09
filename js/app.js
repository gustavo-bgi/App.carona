const appState = {
    config: { mes_atual: 0, ano_atual: 0, valor_padrao: 5 },
    filtroMes: 0, filtroAno: 0,
    pessoas: [], viagens: [], saldos: [],
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!await window.verificarConexao()) return alert('Erro Banco de Dados');
    
    // 1. Carregar Configs
    appState.config = await window.configDB.obter();
    appState.filtroMes = appState.config.mes_atual;
    appState.filtroAno = appState.config.ano_atual;

    configurarEventos();
    atualizarAdminUI();
    await carregarDados();
});

async function carregarDados() {
    mostrarLoading(true);
    try {
        const { data: p } = await window.pessoasDB.listar(); appState.pessoas = p || [];
        const { data: s } = await window.saldosDB.listarAtuais(); appState.saldos = s || [];
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno); appState.viagens = v || [];
        renderizarTela();
    } catch (e) { console.error(e); } 
    finally { mostrarLoading(false); }
}

function renderizarTela() {
    // Topo
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    document.getElementById('labelMesAtual').innerText = `${meses[appState.filtroMes-1]}/${appState.filtroAno}`;
    
    // Dashboard
    const total = appState.viagens.reduce((a,b)=>a+(parseFloat(b.valor_total)||0),0);
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    document.getElementById('custoTotal').innerText = fmtMoeda(total);

    // Tabela Pessoas
    const tbP = document.querySelector('#tabelaPessoas tbody'); tbP.innerHTML = '';
    const listaP = appState.isAdmin ? appState.saldos : appState.saldos.filter(x=>x.ativo);
    
    listaP.forEach(p => {
        const tr = document.createElement('tr');
        if(!p.ativo) tr.style.opacity = '0.5';
        tr.innerHTML = `
            <td>${p.nome} ${!p.ativo ? '(Inativo)' : ''}</td>
            <td class="text-right text-danger">${fmtMoeda(p.a_pagar)}</td>
            <td class="text-right text-success">${fmtMoeda(p.a_receber)}</td>
            <td class="text-right font-bold">${fmtMoeda(p.saldo_liquido)}</td>
            <td class="admin-only"><button class="btn btn-secondary btn-sm" onclick="editarPessoa(${p.id})">✏️</button></td>
        `;
        tbP.appendChild(tr);
    });

    // Tabela Viagens
    const tbV = document.querySelector('#tabelaViagens tbody'); tbV.innerHTML = '';
    appState.viagens.forEach(v => {
        const nomes = v.passageiros?.map(x=>x.pessoa?.nome).join(', ') || '-';
        const vlr = v.passageiros?.[0]?.valor || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${v.motorista?.nome}</td>
            <td><small>${nomes}</small></td>
            <td>${fmtMoeda(vlr)}</td>
            <td><strong>${fmtMoeda(v.valor_total)}</strong></td>
            <td class="admin-only">
                <button class="btn btn-secondary btn-sm" onclick="abrirModalViagem(${v.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button>
            </td>
        `;
        tbV.appendChild(tr);
    });

    popularSelect();
}

// --- LÓGICA DE ADMIN ---
function atualizarAdminUI() {
    const btn = document.getElementById('btnToggleAdmin');
    if (appState.isAdmin) {
        document.body.classList.add('modo-admin-ativo');
        btn.innerText = '🔓';
    } else {
        document.body.classList.remove('modo-admin-ativo');
        btn.innerText = '🔒';
    }
}

async function fecharMes() {
    if(!confirm(`Fechar o mês ${appState.config.mes_atual}/${appState.config.ano_atual}?`)) return;
    mostrarLoading(true);
    let m = appState.config.mes_atual + 1;
    let a = appState.config.ano_atual;
    if(m > 12) { m = 1; a++; }
    await window.configDB.atualizar({ mes_atual: m, ano_atual: a });
    location.reload();
}

async function salvarConfig() {
    const val = parseFloat(document.getElementById('configValorPadrao').value);
    if(val) {
        await window.configDB.atualizar({ valor_padrao: val });
        appState.config.valor_padrao = val;
        alert('Salvo!');
        document.getElementById('modalAdmin').classList.add('hidden');
    }
}

async function toggleAtivo(id, status) {
    await window.pessoasDB.atualizar(id, {ativo: status});
    abrirModalAdmin(); // Refresh lista
    carregarDados();   // Refresh fundo
}

// --- MODAIS E EVENTOS ---
function configurarEventos() {
    // Admin Toggle
    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        atualizarAdminUI();
        renderizarTela(); // Para mostrar/esconder inativos
    };

    document.getElementById('btnAdminPanel').onclick = abrirModalAdmin;
    document.getElementById('btnFecharMes').onclick = fecharMes;
    document.getElementById('btnSalvarConfig').onclick = salvarConfig;

    // Viagem
    document.getElementById('btnSalvarViagem').onclick = async () => {
        const id = document.getElementById('viagemId').value;
        const data = document.getElementById('viagemData').value;
        const mot = document.getElementById('viagemMotorista').value;
        const valUnit = parseFloat(document.getElementById('viagemValorUnitario').value);
        const obs = document.getElementById('viagemObs').value;
        const chks = document.querySelectorAll('.chk-pass:checked');

        if(!data || !mot || !valUnit || chks.length === 0) return alert('Preencha tudo!');

        const pass = Array.from(chks).map(c => ({ pessoa_id: c.value, valor: valUnit, pago: false }));
        const total = valUnit * chks.length;
        const dados = { data, motorista_id: mot, valor_total: total, observacao: obs };

        mostrarLoading(true);
        if(id) await window.viagensDB.atualizar(id, dados, pass);
        else await window.viagensDB.criar(dados, pass);
        document.getElementById('modalViagem').classList.add('hidden');
        carregarDados();
    };

    // Pessoa
    document.getElementById('btnSalvarPessoa').onclick = async () => {
        const id = document.getElementById('pessoaId').value;
        const nome = document.getElementById('pessoaNome').value;
        const ativo = document.getElementById('pessoaAtivo').checked;
        if(!nome) return alert('Nome?');
        
        mostrarLoading(true);
        if(id) await window.pessoasDB.atualizar(id, {nome, ativo});
        else await window.pessoasDB.criar({nome, ativo});
        document.getElementById('modalPessoa').classList.add('hidden');
        carregarDados();
    };

    // Filtro Data
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m);
        appState.filtroAno = parseInt(a);
        carregarDados();
    }

    // Fecha Modais
    document.querySelectorAll('[data-modal]').forEach(b => {
        b.onclick = (e) => document.getElementById(e.target.getAttribute('data-modal')).classList.add('hidden');
    });
}

// --- HELPER OPENERS ---
window.abrirModalViagem = (id) => {
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemValorUnitario').value = appState.config.valor_padrao;
    document.getElementById('viagemObs').value = '';
    
    // Checkboxes Pessoas Ativas
    const div = document.getElementById('listaPassageiros'); div.innerHTML = '';
    appState.pessoas.filter(p=>p.ativo).forEach(p => {
        div.innerHTML += `<label><input type="checkbox" class="chk-pass" value="${p.id}" id="chk_${p.id}"> ${p.nome}</label>`;
    });

    // Motorista Select
    const sel = document.getElementById('viagemMotorista'); sel.innerHTML = '<option value="">...</option>';
    appState.pessoas.filter(p=>p.ativo).forEach(p => sel.add(new Option(p.nome, p.id)));

    if(id) {
        const v = appState.viagens.find(x=>x.id==id);
        if(v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemValorUnitario').value = v.passageiros?.[0]?.valor || 0;
            document.getElementById('viagemObs').value = v.observacao || '';
            v.passageiros?.forEach(p => { if(document.getElementById(`chk_${p.pessoa_id}`)) document.getElementById(`chk_${p.pessoa_id}`).checked = true; });
        }
    }
    document.getElementById('modalViagem').classList.remove('hidden');
};

window.abrirModalPessoa = () => {
    document.getElementById('pessoaId').value = '';
    document.getElementById('pessoaNome').value = '';
    document.getElementById('modalPessoa').classList.remove('hidden');
};

window.editarPessoa = (id) => {
    const p = appState.pessoas.find(x=>x.id==id);
    document.getElementById('pessoaId').value = p.id;
    document.getElementById('pessoaNome').value = p.nome;
    document.getElementById('pessoaAtivo').checked = p.ativo;
    document.getElementById('modalPessoa').classList.remove('hidden');
};

function abrirModalAdmin() {
    document.getElementById('configValorPadrao').value = appState.config.valor_padrao;
    const div = document.getElementById('listaUsuariosAdmin'); div.innerHTML = '';
    appState.pessoas.forEach(p => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee">
                <span>${p.nome}</span>
                <button class="btn btn-sm ${p.ativo?'btn-danger':'btn-primary'}" onclick="toggleAtivo(${p.id}, ${!p.ativo})">
                    ${p.ativo?'Desativar':'Ativar'}
                </button>
            </div>`;
    });
    document.getElementById('modalAdmin').classList.remove('hidden');
}

window.excluirViagem = async (id) => { if(confirm('Apagar?')) { await window.viagensDB.excluir(id); carregarDados(); }};

// Utils
function popularSelect() {
    const s = document.getElementById('mesSelecionado'); s.innerHTML = '';
    let m = appState.config.mes_atual, a = appState.config.ano_atual;
    for(let i=0; i<12; i++) {
        s.add(new Option(`${String(m).padStart(2,'0')}/${a}`, `${m}-${a}`));
        if(--m < 1) { m=12; a--; }
    }
    s.value = `${appState.filtroMes}-${appState.filtroAno}`;
}
function mostrarLoading(show) { document.getElementById('loadingOverlay').classList.toggle('hidden', !show); }
const fmtMoeda = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
