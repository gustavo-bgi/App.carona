// ============================================
// ESTADO GLOBAL
// ============================================
const appState = {
    // Configurações do Sistema
    config: { mes_atual: 0, ano_atual: 0, valor_padrao: 5 },
    
    // Filtros atuais (O que o usuário está vendo)
    filtroMes: 0, 
    filtroAno: 0,
    
    // Dados
    pessoas: [], 
    viagens: [], 
    saldos: [],
    
    // Controle de Admin (Lê do navegador)
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando App...');
    
    if (typeof window.verificarConexao !== 'function') return alert('Erro crítico: db-config.js não carregou.');
    if (!await window.verificarConexao()) return alert('Erro de conexão com o Banco de Dados!');
    
    // 1. Carregar Configurações do Admin (Mês Atual e Valor Padrão)
    appState.config = await window.configDB.obter();
    
    // Por padrão, abre o mês atual do sistema
    appState.filtroMes = appState.config.mes_atual;
    appState.filtroAno = appState.config.ano_atual;

    // 2. Configurar Interface
    configurarEventos();
    atualizarAdminUI(); // Aplica visual de admin se estiver ativo
    
    // 3. Carregar Dados Reais
    await carregarDados();
});

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function carregarDados() {
    mostrarLoading(true);
    try {
        // Pessoas
        const { data: p } = await window.pessoasDB.listar(); 
        appState.pessoas = p || [];
        
        // Saldos (Financeiro)
        const { data: s } = await window.saldosDB.listarAtuais(); 
        appState.saldos = s || [];
        
        // Viagens (Filtradas pelo mês selecionado no topo)
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno); 
        appState.viagens = v || [];
        
        renderizarTela();
    } catch (e) { 
        console.error(e);
        alert('Erro ao carregar dados: ' + e.message);
    } finally { 
        mostrarLoading(false); 
    }
}

function renderizarTela() {
    // 1. Atualizar Título do Mês
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('labelMesAtual').innerText = `${meses[appState.filtroMes-1]} de ${appState.filtroAno}`;
    
    // 2. Atualizar Dashboard
    const totalMovimentado = appState.viagens.reduce((sum, v) => sum + (parseFloat(v.valor_total)||0), 0);
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    document.getElementById('custoTotal').innerText = fmtMoeda(totalMovimentado);

    // 3. Renderizar Tabela Pessoas
    const tbP = document.querySelector('#tabelaPessoas tbody'); 
    tbP.innerHTML = '';
    
    // Se admin: vê todos. Se usuário: vê apenas ativos.
    const listaP = appState.isAdmin ? appState.saldos : appState.saldos.filter(x => x.ativo);
    
    listaP.forEach(p => {
        const tr = document.createElement('tr');
        if(!p.ativo) tr.style.opacity = '0.5'; // Visual de inativo
        
        tr.innerHTML = `
            <td>
                ${p.nome} 
                ${!p.ativo ? '<small style="color:red">(Inativo)</small>' : ''}
            </td>
            <td class="text-right text-danger">${fmtMoeda(p.a_pagar)}</td>
            <td class="text-right text-success">${fmtMoeda(p.a_receber)}</td>
            <td class="text-right font-bold">${fmtMoeda(p.saldo_liquido)}</td>
            <td class="admin-only">
                <button class="btn btn-secondary btn-sm" onclick="editarPessoa(${p.id})">✏️</button>
            </td>
        `;
        tbP.appendChild(tr);
    });

    // 4. Renderizar Tabela Viagens
    const tbV = document.querySelector('#tabelaViagens tbody'); 
    tbV.innerHTML = '';
    
    if (appState.viagens.length === 0) {
        tbV.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Nenhuma viagem neste mês.</td></tr>';
    } else {
        appState.viagens.forEach(v => {
            const nomes = v.passageiros?.map(x => x.pessoa?.nome).join(', ') || '-';
            const vlrUnit = v.passageiros?.[0]?.valor || 0;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(v.data+'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${v.motorista?.nome || '?'}</td>
                <td><small>${nomes}</small></td>
                <td>${fmtMoeda(vlrUnit)}</td>
                <td><strong>${fmtMoeda(v.valor_total)}</strong></td>
                <td class="admin-only">
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalViagem(${v.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button>
                </td>
            `;
            tbV.appendChild(tr);
        });
    }

    // 5. Atualizar Select de Datas (IMPORTANTE: Lógica corrigida)
    popularSelect();
}

// ============================================
// LÓGICA DE ADMIN E CONFIGURAÇÃO
// ============================================

function atualizarAdminUI() {
    const btn = document.getElementById('btnToggleAdmin');
    if (appState.isAdmin) {
        document.body.classList.add('modo-admin-ativo');
        btn.innerText = '🔓'; // Cadeado aberto
        btn.style.opacity = '1';
    } else {
        document.body.classList.remove('modo-admin-ativo');
        btn.innerText = '🔒'; // Cadeado fechado
        btn.style.opacity = '0.4';
    }
}

async function fecharMes() {
    if(!confirm(`ATENÇÃO: Você vai encerrar o mês ${appState.config.mes_atual}/${appState.config.ano_atual}. \n\nIsso fará o sistema avançar para o próximo mês. Confirma?`)) return;
    
    mostrarLoading(true);
    let m = appState.config.mes_atual + 1;
    let a = appState.config.ano_atual;
    
    if(m > 12) { m = 1; a++; }
    
    try {
        await window.configDB.atualizar({ mes_atual: m, ano_atual: a });
        alert(`Mês fechado com sucesso! Iniciando ${m}/${a}`);
        location.reload(); // Recarrega para aplicar novo mês
    } catch (e) {
        alert('Erro ao fechar mês: ' + e.message);
        mostrarLoading(false);
    }
}

async function salvarConfig() {
    const val = parseFloat(document.getElementById('configValorPadrao').value);
    if (!val || val <= 0) return alert('Valor inválido!');
    
    try {
        await window.configDB.atualizar({ valor_padrao: val });
        appState.config.valor_padrao = val;
        alert('Configuração salva!');
        document.getElementById('modalAdmin').classList.add('hidden');
    } catch (e) {
        alert('Erro: ' + e.message);
    }
}

async function toggleAtivo(id, statusAtual) {
    const novoStatus = !statusAtual;
    try {
        await window.pessoasDB.atualizar(id, {ativo: novoStatus});
        // Atualiza UI Admin
        abrirModalAdmin();
        // Atualiza Tabela de Fundo
        carregarDados();
    } catch (e) {
        alert('Erro ao alterar status');
    }
}

// ============================================
// EVENTOS E MODAIS
// ============================================

function configurarEventos() {
    // Botão Cadeado
    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        atualizarAdminUI();
        renderizarTela(); // Re-renderiza para mostrar/esconder colunas
    };

    // Botões Admin
    document.getElementById('btnAdminPanel').onclick = abrirModalAdmin;
    document.getElementById('btnFecharMes').onclick = fecharMes;
    document.getElementById('btnSalvarConfig').onclick = salvarConfig;

    // Botão Nova Viagem
    document.getElementById('btnSalvarViagem').onclick = async () => {
        const id = document.getElementById('viagemId').value;
        const data = document.getElementById('viagemData').value;
        const mot = document.getElementById('viagemMotorista').value;
        const valUnit = parseFloat(document.getElementById('viagemValorUnitario').value);
        const obs = document.getElementById('viagemObs').value;
        const chks = document.querySelectorAll('.chk-pass:checked');

        if(!data || !mot || !valUnit) return alert('Preencha Data, Motorista e Valor.');
        if(chks.length === 0) return alert('Selecione ao menos um passageiro.');

        const pass = Array.from(chks).map(c => ({ 
            pessoa_id: c.value, 
            valor: valUnit, 
            pago: false 
        }));
        
        const total = valUnit * chks.length;
        const dados = { data, motorista_id: mot, valor_total: total, observacao: obs };

        mostrarLoading(true);
        try {
            if(id) await window.viagensDB.atualizar(id, dados, pass);
            else await window.viagensDB.criar(dados, pass);
            
            document.getElementById('modalViagem').classList.add('hidden');
            await carregarDados();
        } catch (e) {
            alert(e.message);
        } finally {
            mostrarLoading(false);
        }
    };

    // Botão Nova Pessoa
    document.getElementById('btnSalvarPessoa').onclick = async () => {
        const id = document.getElementById('pessoaId').value;
        const nome = document.getElementById('pessoaNome').value;
        const ativo = document.getElementById('pessoaAtivo').checked;
        
        if(!nome) return alert('Digite o nome.');
        
        mostrarLoading(true);
        try {
            if(id) await window.pessoasDB.atualizar(id, {nome, ativo});
            else await window.pessoasDB.criar({nome, ativo});
            
            document.getElementById('modalPessoa').classList.add('hidden');
            await carregarDados();
        } catch (e) {
            alert(e.message);
        } finally {
            mostrarLoading(false);
        }
    };

    // Filtro de Mês (Change)
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m);
        appState.filtroAno = parseInt(a);
        carregarDados();
    };

    // Fechar Modais
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(b => {
        // Ignora botões secondary que são de ação (editar), pega só os de cancelar/fechar
        if(b.innerText === 'Cancelar' || b.classList.contains('modal-close')) {
            b.onclick = (e) => {
                const modal = e.target.closest('.modal');
                if(modal) modal.classList.add('hidden');
            };
        }
    });
}

// ============================================
// HELPERS (ABERTURA DE MODAIS)
// ============================================

window.abrirModalViagem = (id) => {
    // Reset
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemValorUnitario').value = appState.config.valor_padrao;
    document.getElementById('viagemObs').value = '';
    
    // Lista de Passageiros (Checkboxes)
    const div = document.getElementById('listaPassageiros'); 
    div.innerHTML = '';
    
    // Mostra apenas ativos na criação de viagem
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        div.innerHTML += `
            <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
                <input type="checkbox" class="chk-pass" value="${p.id}" id="chk_${p.id}"> 
                ${p.nome}
            </label>`;
    });

    // Select Motorista
    const sel = document.getElementById('viagemMotorista'); 
    sel.innerHTML = '<option value="">Selecione...</option>';
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        sel.add(new Option(p.nome, p.id));
    });

    // Se for edição, preenche dados
    if(id) {
        const v = appState.viagens.find(x => x.id == id);
        if(v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemObs').value = v.observacao || '';
            if(v.passageiros?.[0]) document.getElementById('viagemValorUnitario').value = v.passageiros[0].valor;
            
            // Marca checkboxes
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
    const p = appState.saldos.find(x => x.id == id); // Busca nos saldos pq tem todos
    document.getElementById('pessoaId').value = p.id;
    document.getElementById('pessoaNome').value = p.nome;
    document.getElementById('pessoaAtivo').checked = p.ativo;
    document.getElementById('modalPessoa').classList.remove('hidden');
};

function abrirModalAdmin() {
    document.getElementById('configValorPadrao').value = appState.config.valor_padrao;
    const div = document.getElementById('listaUsuariosAdmin'); 
    div.innerHTML = '';
    
    appState.saldos.forEach(p => {
        div.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee">
                <span>${p.nome}</span>
                <button class="btn btn-sm ${p.ativo ? 'btn-danger' : 'btn-primary'}" 
                    onclick="toggleAtivo(${p.id}, ${p.ativo})">
                    ${p.ativo ? 'Desativar' : 'Ativar'}
                </button>
            </div>`;
    });
    document.getElementById('modalAdmin').classList.remove('hidden');
}

window.excluirViagem = async (id) => { 
    if(confirm('Tem certeza que deseja excluir esta viagem?')) { 
        mostrarLoading(true);
        await window.viagensDB.excluir(id); 
        await carregarDados(); 
    }
};

// Utils UI
function popularSelect() {
    const select = document.getElementById('mesSelecionado');
    const valorAntes = select.value;
    select.innerHTML = '';

    let m = appState.config.mes_atual;
    let a = appState.config.ano_atual;

    // Gera lista regressiva (Mês atual -> Passado)
    for(let i=0; i<12; i++) {
        const txt = `${String(m).padStart(2,'0')}/${a}`;
        const val = `${m}-${a}`;
        
        const opt = document.createElement('option');
        opt.value = val;
        opt.text = i === 0 ? `${txt} (Aberto)` : txt;
        select.appendChild(opt);

        m--;
        if(m < 1) { m=12; a--; }
    }

    // Mantém seleção se possível
    if(valorAntes && select.querySelector(`option[value="${valorAntes}"]`)) {
        select.value = valorAntes;
    } else {
        select.selectedIndex = 0;
    }
}

function mostrarLoading(show) { 
    document.getElementById('loadingOverlay').classList.toggle('hidden', !show); 
}

const fmtMoeda = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
