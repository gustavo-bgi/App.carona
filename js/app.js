const appState = {
    config: { mes_atual: 2, ano_atual: 2026, valor_padrao: 5 },
    filtroMes: 2, filtroAno: 2026,
    pessoas: [], viagens: [], saldos: [],
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const conf = await window.configDB.obter();
        if(conf) appState.config = conf;
        
        appState.filtroMes = appState.config.mes_atual;
        appState.filtroAno = appState.config.ano_atual;
        
        configurarInterface();
        await carregarDados();
    } catch(e) { console.error("Erro ao iniciar", e); }
});

async function carregarDados() {
    mostrarLoading(true);
    try {
        const { data: p } = await window.pessoasDB.listar();
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno);
        const { data: s } = await window.saldosDB.listarAtuais();
        
        appState.pessoas = p || [];
        appState.viagens = v || [];
        
        // Cálculo de saldo vinculado apenas ao que está em tela
        appState.saldos = s.map(pessoa => {
            let pagarMes = 0; let receberMes = 0;
            appState.viagens.forEach(viagem => {
                if (viagem.motorista_id === pessoa.id) {
                    receberMes += viagem.passageiros.reduce((acc, pass) => acc + parseFloat(pass.valor), 0);
                }
                const souPassageiro = viagem.passageiros.find(pass => pass.pessoa_id === pessoa.id);
                if (souPassageiro) pagarMes += parseFloat(souPassageiro.valor);
            });
            return { ...pessoa, a_pagar: pagarMes, a_receber: receberMes, saldo_liquido: receberMes - pagarMes };
        });
        
        renderizar();
    } catch(e) { console.error(e); }
    finally { mostrarLoading(false); }
}

function renderizar() {
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const label = document.getElementById('labelMes') || document.getElementById('mesAtual');
    if(label) label.innerText = `${meses[appState.filtroMes-1]}/${appState.filtroAno}`;

    // Tabela Saldos
    const tbS = document.querySelector('#tabelaPessoas tbody');
    if(tbS) {
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
    }

    // Tabela Viagens
    const tbV = document.querySelector('#tabelaViagens tbody');
    if(tbV) {
        tbV.innerHTML = '';
        appState.viagens.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${v.motorista?.nome || '?'}</td>
                <td class="text-right">${fmtMoeda(v.valor_total)}</td>
                <td class="admin-only"><button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button></td>
            `;
            tbV.appendChild(tr);
        });
    }

    popularSelectMeses();
    document.body.classList.toggle('modo-admin-ativo', appState.isAdmin);
}

function configurarInterface() {
    // Botão Nova Viagem
    const btnV = document.getElementById('btnNovaViagemLink') || document.getElementById('btnNovaViagem');
    if(btnV) btnV.onclick = () => window.abrirModalViagem();

    // Botão Nova Pessoa
    const btnP = document.getElementById('btnNovaPessoa');
    if(btnP) btnP.onclick = () => window.abrirModalPessoa();

    // Botão Admin / Cadeado
    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        renderizar();
    };

    // Fechar Modais (O "X" e botões cancelar)
    document.querySelectorAll('.modal-close, [data-modal]').forEach(botao => {
        botao.onclick = () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        };
    });

    // Salvar Dados
    document.getElementById('btnSalvarViagem').onclick = salvarViagem;
    document.getElementById('btnSalvarPessoa').onclick = salvarPessoa;
    document.getElementById('btnFecharMes').onclick = fecharMes;
    
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m); appState.filtroAno = parseInt(a);
        carregarDados();
    };
}

// --- FUNÇÕES DE PESSOA ---
window.abrirModalPessoa = () => {
    document.getElementById('pessoaId').value = '';
    document.getElementById('pessoaNome').value = '';
    document.getElementById('modalPessoa').classList.remove('hidden');
};

async function salvarPessoa() {
    const nome = document.getElementById('pessoaNome').value;
    if(!nome) return alert("Digite o nome");
    try {
        mostrarLoading(true);
        await window.pessoasDB.criar({ nome, ativo: true });
        document.getElementById('modalPessoa').classList.add('hidden');
        await carregarDados();
    } catch(e) { alert("Erro ao salvar pessoa"); }
}

// --- FUNÇÕES DE VIAGEM ---
window.abrirModalViagem = () => {
    document.getElementById('viagemId').value = '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemValorUnit').value = appState.config.valor_padrao; // Volta o valor padrão
    
    const selMot = document.getElementById('viagemMotorista');
    selMot.innerHTML = '<option value="">Motorista...</option>';
    appState.pessoas.filter(p=>p.ativo).forEach(p => selMot.add(new Option(p.nome, p.id)));

    const divPass = document.getElementById('listaPassageiros');
    divPass.innerHTML = '';
    appState.pessoas.filter(p=>p.ativo).forEach(p => {
        divPass.innerHTML += `<label style="display:block; padding:8px;"><input type="checkbox" class="chk-pass" value="${p.id}"> ${p.nome}</label>`;
    });

    document.getElementById('modalViagem').classList.remove('hidden');
};

async function salvarViagem() {
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const valorUnit = parseFloat(document.getElementById('viagemValorUnit').value);
    const checks = document.querySelectorAll('.chk-pass:checked');

    if(!data || !motorista_id || !valorUnit || checks.length === 0) return alert('Preencha todos os campos!');

    const dados = { data, motorista_id, valor_total: valorUnit * checks.length };
    const passageiros = Array.from(checks).map(c => ({ pessoa_id: c.value, valor: valorUnit, pago: false }));

    try {
        mostrarLoading(true);
        await window.viagensDB.criar(dados, passageiros);
        document.getElementById('modalViagem').classList.add('hidden');
        await carregarDados();
    } catch(e) { alert("Erro ao salvar viagem"); }
}

// --- UTILITÁRIOS ---
function popularSelectMeses() {
    const sel = document.getElementById('mesSelecionado');
    const selecionado = `${appState.filtroMes}-${appState.filtroAno}`;
    sel.innerHTML = '';
    let m = appState.config.mes_atual; let a = appState.config.ano_atual;
    for(let i=0; i<12; i++) {
        if(a < 2026 || (a === 2026 && m < 2)) break;
        const opt = new Option(`${String(m).padStart(2,'0')}/${a} ${i===0?'(Aberto)':''}`, `${m}-${a}`);
        sel.add(opt);
        if(--m < 1) { m=12; a--; }
    }
    sel.value = selecionado;
}

async function fecharMes() {
    if(!confirm("Encerrar este mês?")) return;
    let nM = appState.config.mes_atual + 1; let nA = appState.config.ano_atual;
    if(nM > 12) { nM = 1; nA++; }
    await window.configDB.atualizar({ mes_atual: nM, ano_atual: nA });
    location.reload();
}

const fmtMoeda = (v) => parseFloat(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const mostrarLoading = (s) => document.getElementById('loadingOverlay').classList.toggle('hidden', !s);
