// ============================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================
const appState = {
    // Configurações vindas do Banco (Mês Aberto e Valor Padrão)
    config: { mes_atual: 0, ano_atual: 0, valor_padrao: 5 },
    
    // Filtros de visualização (O que o usuário selecionou no topo)
    filtroMes: 0, 
    filtroAno: 0,
    
    // Dados carregados
    pessoas: [], 
    viagens: [], 
    saldos: [],
    
    // Controle de Permissão
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação...');
    
    try {
        // 1. Verificar conexão com o banco
        if (typeof window.verificarConexao !== 'function') {
            throw new Error('Script db-config.js não encontrado ou incompleto.');
        }
        
        const conectado = await window.verificarConexao();
        if (!conectado) return;

        // 2. Carregar Configurações do Sistema (Admin)
        appState.config = await window.configDB.obter();
        
        // Define a visão inicial como o mês atual do sistema
        appState.filtroMes = appState.config.mes_atual;
        appState.filtroAno = appState.config.ano_atual;

        // 3. Configurar Interface
        atualizarAdminUI();
        configurarEventos();
        
        // 4. Carregar Dados Reais
        await carregarDados();
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao iniciar app: ' + error.message);
    }
});

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function carregarDados() {
    mostrarLoading(true);
    try {
        // Busca Pessoas
        const { data: p } = await window.pessoasDB.listar(); 
        appState.pessoas = p || [];
        
        // Busca Viagens do Mês Selecionado
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno); 
        appState.viagens = v || [];
        
        // Busca Saldos (View)
        const { data: s } = await window.saldosDB.listarAtuais(); 
        appState.saldos = s || [];
        
        renderizarTela();
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// RENDERIZAÇÃO DA INTERFACE
// ============================================
function renderizarTela() {
    // 1. Título do Mês
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('labelMesAtual').innerText = `${meses[appState.filtroMes-1]} de ${appState.filtroAno}`;
    
    // 2. Dashboard
    const totalMovimentado = appState.viagens.reduce((sum, v) => sum + (parseFloat(v.valor_total)||0), 0);
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    document.getElementById('custoTotal').innerText = fmtMoeda(totalMovimentado);

    // 3. Tabela de Pessoas / Saldos
    const tbP = document.querySelector('#tabelaPessoas tbody');
    tbP.innerHTML = '';
    
    // Se não for admin, oculta inativos
    const listaExibir = appState.isAdmin ? appState.saldos : appState.saldos.filter(x => x.ativo);
    
    listaExibir.forEach(p => {
        const tr = document.createElement('tr');
        if(!p.ativo) tr.style.opacity = '0.5';
        
        tr.innerHTML = `
            <td><strong>${p.nome}</strong> ${!p.ativo ? '<small>(Inativo)</small>' : ''}</td>
            <td class="text-right text-danger">${fmtMoeda(p.a_pagar)}</td>
            <td class="text-right text-success">${fmtMoeda(p.a_receber)}</td>
            <td class="text-right font-bold">${fmtMoeda(p.saldo_liquido)}</td>
            <td class="admin-only">
                <button class="btn btn-secondary btn-sm" onclick="window.editarPessoa(${p.id})">✏️</button>
            </td>
        `;
        tbP.appendChild(tr);
    });

    // 4. Tabela de Viagens
    const tbV = document.querySelector('#tabelaViagens tbody');
    tbV.innerHTML = '';
    
    if (appState.viagens.length === 0) {
        tbV.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma viagem neste mês.</td></tr>';
    } else {
        appState.viagens.forEach(v => {
            const vlrUnit = v.passageiros?.[0]?.valor || 0;
            const nomes = v.passageiros?.map(x => x.pessoa?.nome).join(', ') || '-';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fmtData(v.data)}</td>
                <td>${v.motorista?.nome || '?'}</td>
                <td><small>${nomes}</small></td>
                <td>${fmtMoeda(vlrUnit)}</td>
                <td><strong>${fmtMoeda(v.valor_total)}</strong></td>
                <td class="admin-only">
                    <button class="btn btn-secondary btn-sm" onclick="window.abrirModalViagem(${v.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="window.excluirViagem(${v.id})">🗑️</button>
                </td>
            `;
            tbV.appendChild(tr);
        });
    }

    popularSelectMeses();
    atualizarAdminUI();
}

// ============================================
// LÓGICA DE ADMIN E CONFIGURAÇÕES
// ============================================
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

async function realizarFechamento() {
    if(!confirm(`Fechar mês ${appState.config.mes_atual}/${appState.config.ano_atual}?`)) return;
    
    mostrarLoading(true);
    let m = appState.config.mes_atual + 1;
    let a = appState.config.ano_atual;
    if(m > 12) { m = 1; a++; }
    
    try {
        await window.configDB.atualizar({ mes_atual: m, ano_atual: a });
        alert('Mês fechado com sucesso!');
        location.reload();
    } catch (e) {
        alert('Erro: ' + e.message);
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// EVENTOS E MODAIS
// ============================================
function configurarEventos() {
    // Admin
    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        atualizarAdminUI();
        renderizarTela();
    };

    document.getElementById('btnAdminPanel').onclick = abrirModalAdmin;
    document.getElementById('btnFecharMes').onclick = realizarFechamento;
    
    document.getElementById('btnSalvarConfig').onclick = async () => {
        const val = parseFloat(document.getElementById('configValorPadrao').value);
        if(!val) return;
        await window.configDB.atualizar({ valor_padrao: val });
        appState.config.valor_padrao = val;
        alert('Configuração salva!');
        document.getElementById('modalAdmin').classList.add('hidden');
    };

    // Filtro de Data
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m);
        appState.filtroAno = parseInt(a);
        carregarDados();
    };

    // Salvar Viagem
    document.getElementById('btnSalvarViagem').onclick = async () => {
        const id = document.getElementById('viagemId').value;
        const data = document.getElementById('viagemData').value;
        const motorista_id = document.getElementById('viagemMotorista').value;
        const valorUnitario = parseFloat(document.getElementById('viagemValorUnitario').value);
        const obs = document.getElementById('viagemObs').value;
        
        const checks = document.querySelectorAll('.chk-pass:checked');
        if(!data || !motorista_id || !valorUnitario || checks.length === 0) {
            return alert('Preencha todos os campos e selecione passageiros.');
        }

        const passageiros = Array.from(checks).map(c => ({
            pessoa_id: c.value, valor: valorUnitario, pago: false
        }));

        const total = valorUnitario * checks.length;
        const dados = { data, motorista_id, valor_total: total, observacao: obs };

        mostrarLoading(true);
        try {
            if(id) await window.viagensDB.atualizar(id, dados, passageiros);
            else await window.viagensDB.criar(dados, passageiros);
            document.getElementById('modalViagem').classList.add('hidden');
            await carregarDados();
        } catch (e) { alert(e.message); }
        finally { mostrarLoading(false); }
    };

    // Salvar Pessoa
    document.getElementById('btnSalvarPessoa').onclick = async () => {
        const id = document.getElementById('pessoaId').value;
        const nome = document.getElementById('pessoaNome').value;
        const ativo = document.getElementById('pessoaAtivo').checked;
        
        mostrarLoading(true);
        try {
            if(id) await window.pessoasDB.atualizar(id, { nome, ativo });
            else await window.pessoasDB.criar({ nome, ativo });
            document.getElementById('modalPessoa').classList.add('hidden');
            await carregarDados();
        } catch (e) { alert(e.message); }
        finally { mostrarLoading(false); }
    };

    // Botões de fechar modal
    document.querySelectorAll('[data-modal]').forEach(b => {
        b.onclick = (e) => {
            const mId = e.target.getAttribute('data-modal');
            document.getElementById(mId).classList.add('hidden');
        };
    });
}

// ============================================
// HELPERS E UTILS
// ============================================
window.abrirModalViagem = (id = null) => {
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemValorUnitario').value = appState.config.valor_padrao;
    document.getElementById('viagemObs').value = '';

    const div = document.getElementById('listaPassageiros'); div.innerHTML = '';
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        div.innerHTML += `<label><input type="checkbox" class="chk-pass" value="${p.id}" id="chk_${p.id}"> ${p.nome}</label>`;
    });

    const sel = document.getElementById('viagemMotorista'); sel.innerHTML = '<option value="">...</option>';
    appState.pessoas.filter(p => p.ativo).forEach(p => sel.add(new Option(p.nome, p.id)));

    if(id) {
        const v = appState.viagens.find(x => x.id == id);
        if(v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemObs').value = v.observacao || '';
            v.passageiros?.forEach(p => { 
                const el = document.getElementById(`chk_${p.pessoa_id}`);
                if(el) el.checked = true; 
            });
        }
    }
    document.getElementById('modalViagem').classList.remove('hidden');
};

window.abrirModalPessoa = () => {
    document.getElementById('pessoaId').value = '';
    document.getElementById('pessoaNome').value = '';
    document.getElementById('pessoaAtivo').checked = true;
    document.getElementById('modalPessoa').classList.remove('hidden');
};

window.editarPessoa = (id) => {
    const p = appState.pessoas.find(x => x.id == id);
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
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee">
                <span>${p.nome}</span>
                <button class="btn btn-sm ${p.ativo ? 'btn-danger' : 'btn-primary'}" 
                    onclick="toggleUsuarioAtivo(${p.id}, ${p.ativo})">
                    ${p.ativo ? 'Desativar' : 'Ativar'}
                </button>
            </div>`;
    });
    document.getElementById('modalAdmin').classList.remove('hidden');
}

window.excluirViagem = async (id) => {
    if(confirm('Excluir viagem?')) {
        await window.viagensDB.excluir(id);
        await carregarDados();
    }
};

window.toggleUsuarioAtivo = async (id, status) => {
    await window.pessoasDB.atualizar(id, { ativo: !status });
    abrirModalAdmin();
    carregarDados();
};

function popularSelectMeses() {
    const s = document.getElementById('mesSelecionado');
    const vAntes = s.value;
    s.innerHTML = '';
    let m = appState.config.mes_atual, a = appState.config.ano_atual;
    for(let i=0; i<12; i++) {
        const val = `${m}-${a}`;
        s.add(new Option(`${String(m).padStart(2,'0')}/${a}${i===0?' (Aberto)':''}`, val));
        if(--m < 1) { m=12; a--; }
    }
    if(vAntes) s.value = vAntes;
}

function mostrarLoading(show) { document.getElementById('loadingOverlay').classList.toggle('hidden', !show); }
const fmtMoeda = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const fmtData = (d) => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
