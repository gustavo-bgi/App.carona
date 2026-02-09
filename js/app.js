// ============================================
// ESTADO GLOBAL
// ============================================
const appState = {
    // Configurações vindas do Banco
    config: { mes_atual: 0, ano_atual: 0, valor_padrao: 0 },
    
    // Filtro visual atual
    filtroMes: 0,
    filtroAno: 0,
    
    // Dados
    pessoas: [],
    viagens: [],
    saldos: [],
    
    // Controle
    isAdmin: localStorage.getItem('modoAdmin') === 'true' // Lembra se é admin
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!await window.verificarConexao()) return alert('Erro de conexão!');
    
    // 1. Carrega configurações do sistema (Mês Aberto e Valor Padrão)
    appState.config = await window.configDB.obter();
    
    // Define o filtro inicial como o mês atual do sistema
    appState.filtroMes = appState.config.mes_atual;
    appState.filtroAno = appState.config.ano_atual;

    // Configura UI
    atualizarModoAdmin(); // Aplica classes CSS
    configurarEventos();
    
    // Carrega dados
    await carregarDados();
});

// ============================================
// LÓGICA PRINCIPAL
// ============================================

async function carregarDados() {
    mostrarLoading(true);
    try {
        // 1. Pessoas
        const { data: pessoas } = await window.pessoasDB.listar();
        appState.pessoas = pessoas || [];

        // 2. Saldos
        const { data: saldos } = await window.saldosDB.listarAtuais();
        appState.saldos = saldos || [];

        // 3. Viagens (Baseado no filtro selecionado)
        const { data: viagens } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno);
        appState.viagens = viagens || [];

        renderizarTela();
    } catch (err) {
        console.error(err);
    } finally {
        mostrarLoading(false);
    }
}

function renderizarTela() {
    // Atualiza Texto do Mês
    const nomesMeses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const nomeMes = nomesMeses[appState.filtroMes - 1];
    document.getElementById('labelMesAtual').innerText = `${nomeMes}/${appState.filtroAno}`;

    // Atualiza Dropdown (Popula com histórico até o mês atual)
    popularSelectMeses();

    // Dashboard
    const totalMovimentado = appState.viagens.reduce((acc, v) => acc + (parseFloat(v.valor_total)||0), 0);
    document.getElementById('totalViagens').innerText = appState.viagens.length;
    document.getElementById('custoTotal').innerText = totalMovimentado.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    // Tabela Pessoas
    const tbodyPessoas = document.querySelector('#tabelaPessoas tbody');
    tbodyPessoas.innerHTML = '';
    
    // Filtra: Se não for admin, mostra só ativos. Se for admin, mostra todos.
    const pessoasExibir = appState.isAdmin ? appState.saldos : appState.saldos.filter(p => p.ativo);
    
    pessoasExibir.forEach(p => {
        const tr = document.createElement('tr');
        if(!p.ativo) tr.style.opacity = '0.5'; // Visual de inativo
        
        const nomeDisplay = p.ativo ? p.nome : `${p.nome} (Inativo)`;
        
        tr.innerHTML = `
            <td>${nomeDisplay}</td>
            <td class="text-right text-danger">${fmtMoeda(p.a_pagar)}</td>
            <td class="text-right text-success">${fmtMoeda(p.a_receber)}</td>
            <td class="text-right font-bold">${fmtMoeda(p.saldo_liquido)}</td>
            <td class="admin-only">
                <button class="btn btn-secondary btn-sm" onclick="editarPessoa(${p.id})">✏️</button>
            </td>
        `;
        tbodyPessoas.appendChild(tr);
    });

    // Tabela Viagens
    const tbodyViagens = document.querySelector('#tabelaViagens tbody');
    tbodyViagens.innerHTML = '';
    
    if (appState.viagens.length === 0) {
        tbodyViagens.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma viagem neste período.</td></tr>';
    } else {
        appState.viagens.forEach(v => {
            const vlrUnit = v.passageiros?.[0]?.valor || 0;
            const nomes = v.passageiros?.map(p => p.pessoa?.nome).join(', ') || '-';
            
            tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fmtData(v.data)}</td>
                <td>${v.motorista?.nome || '?'}</td>
                <td><small>${nomes}</small></td>
                <td>${fmtMoeda(vlrUnit)}</td>
                <td><strong>${fmtMoeda(v.valor_total)}</strong></td>
                <td class="admin-only">
                    <button class="btn btn-secondary btn-sm" onclick="abrirModalViagem(${v.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button>
                </td>
            `;
            tbodyViagens.appendChild(tr);
        });
    }

    // Reaplicar visibilidade admin nas linhas criadas
    atualizarModoAdmin();
}

// ============================================
// FUNÇÕES ADMINISTRATIVAS
// ============================================

// Toggle Admin (Cadeado)
function toggleAdmin() {
    appState.isAdmin = !appState.isAdmin;
    localStorage.setItem('modoAdmin', appState.isAdmin);
    atualizarModoAdmin();
    renderizarTela(); // Re-renderiza para mostrar inativos se necessário
}

function atualizarModoAdmin() {
    const body = document.body;
    const btn = document.getElementById('btnToggleAdmin');
    
    if (appState.isAdmin) {
        body.classList.add('modo-admin-ativo');
        btn.innerText = '🔓'; // Cadeado aberto
        btn.style.opacity = '1';
    } else {
        body.classList.remove('modo-admin-ativo');
        btn.innerText = '🔒'; // Cadeado fechado
        btn.style.opacity = '0.5';
    }
}

// Fechar Mês (Avançar calendário)
async function fecharMesAtual() {
    if(!confirm(`Confirma fechar o mês atual (${appState.config.mes_atual}/${appState.config.ano_atual}) e iniciar o próximo?`)) return;

    mostrarLoading(true);
    try {
        let novoMes = appState.config.mes_atual + 1;
        let novoAno = appState.config.ano_atual;

        if (novoMes > 12) {
            novoMes = 1;
            novoAno++;
        }

        // Atualiza no banco
        await window.configDB.atualizar({ mes_atual: novoMes, ano_atual: novoAno });
        
        alert(`Mês fechado! Iniciando ${novoMes}/${novoAno}`);
        location.reload(); // Recarrega para pegar configs novas
    } catch (err) {
        alert('Erro ao fechar mês: ' + err.message);
        mostrarLoading(false);
    }
}

// Painel Admin (Configurações)
function abrirAdminPanel() {
    document.getElementById('configValorPadrao').value = appState.config.valor_padrao;
    
    // Lista de Usuários para ativar/desativar
    const lista = document.getElementById('listaUsuariosAdmin');
    lista.innerHTML = '';
    appState.pessoas.forEach(p => {
        const div = document.createElement('div');
        div.style.padding = '5px';
        div.style.borderBottom = '1px solid #eee';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.innerHTML = `
            <span>${p.nome}</span>
            <button class="btn btn-sm ${p.ativo ? 'btn-danger' : 'btn-primary'}" 
                onclick="toggleUsuarioAtivo(${p.id}, ${!p.ativo})">
                ${p.ativo ? 'Desativar' : 'Ativar'}
            </button>
        `;
        lista.appendChild(div);
    });

    document.getElementById('modalAdmin').classList.remove('hidden');
}

async function salvarConfigValor() {
    const novoValor = parseFloat(document.getElementById('configValorPadrao').value);
    if (!novoValor) return alert('Valor inválido');
    
    await window.configDB.atualizar({ valor_padrao: novoValor });
    appState.config.valor_padrao = novoValor;
    alert('Valor padrão atualizado!');
}

async function toggleUsuarioAtivo(id, novoStatus) {
    await window.pessoasDB.atualizar(id, { ativo: novoStatus });
    // Atualiza localmente e reabre o painel para refletir
    const p = appState.pessoas.find(x => x.id === id);
    if(p) p.ativo = novoStatus;
    abrirAdminPanel();
    carregarDados(); // Atualiza fundo
}

// ============================================
// HELPERS
// ============================================

function popularSelectMeses() {
    const select = document.getElementById('mesSelecionado');
    const valorAtual = select.value; // Tenta manter seleção
    select.innerHTML = '';

    // Lógica: Gera lista de 12 meses atrás até o Mês Atual do sistema
    // Não deixa selecionar meses futuros que ainda não foram abertos
    
    let m = appState.config.mes_atual;
    let a = appState.config.ano_atual;
    
    // Gera opções decrescentes (Atual -> Passado)
    for (let i = 0; i < 12; i++) {
        const label = `${String(m).padStart(2,'0')}/${a}`;
        const value = `${m}-${a}`; // ex: 2-2026
        
        const option = document.createElement('option');
        option.value = value;
        option.text = label + (i===0 ? ' (Atual)' : '');
        select.appendChild(option);

        // Volta um mês
        m--;
        if (m < 1) { m = 12; a--; }
    }

    // Se mudou via código (init), seleciona o primeiro (atual)
    // Se foi clique do usuário, mantém seleção
    if (appState.filtroMes + '-' + appState.filtroAno === valorAtual) {
        select.value = valorAtual;
    } else {
        select.selectedIndex = 0; // Seleciona o atual por padrão
    }
}

function configurarEventos() {
    // Admin Toggle
    document.getElementById('btnToggleAdmin').onclick = toggleAdmin;
    document.getElementById('btnAdminPanel').onclick = abrirAdminPanel;
    document.getElementById('cardFecharMes').onclick = fecharMesAtual;
    document.getElementById('btnSalvarConfigValor').onclick = salvarConfigValor;

    // Seletor de Data
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m);
        appState.filtroAno = parseInt(a);
        carregarDados();
    };

    // Botões Padrão
    document.getElementById('btnNovaViagem').onclick = () => abrirModalViagem();
    
    // Salvar Viagem
    document.getElementById('btnSalvarViagem').onclick = async () => {
        const id = document.getElementById('viagemId').value;
        const data = document.getElementById('viagemData').value;
        const motorista_id = document.getElementById('viagemMotorista').value;
        const valorUnitario = parseFloat(document.getElementById('viagemValorPorPessoa').value);
        const obs = document.getElementById('viagemObservacao').value;

        if (!data || !motorista_id || !valorUnitario) return alert('Preencha os dados.');
        
        const checks = document.querySelectorAll('.chk-passageiro:checked');
        if (checks.length === 0) return alert('Selecione passageiros.');

        const total = valorUnitario * checks.length;
        const passageiros = Array.from(checks).map(c => ({
            pessoa_id: c.value, valor: valorUnitario, pago: false
        }));

        mostrarLoading(true);
        try {
            if(id) await window.viagensDB.atualizar(id, { data, motorista_id, valor_total: total, observacao: obs }, passageiros);
            else await window.viagensDB.criar({ data, motorista_id, valor_total: total, observacao: obs }, passageiros);
            
            document.getElementById('modalViagem').classList.add('hidden');
            carregarDados();
        } catch(e) { alert(e.message); }
        finally { mostrarLoading(false); }
    };

    // Modais Close
    document.querySelectorAll('.modal-close, [data-modal]').forEach(b => {
        b.onclick = (e) => {
            const id = e.target.getAttribute('data-modal') || e.target.closest('.modal').id;
            document.getElementById(id).classList.add('hidden');
        };
    });
    
    // Salvar Pessoa (Admin)
    document.getElementById('btnSalvarPessoa').onclick = async () => {
        const id = document.getElementById('pessoaId').value;
        const nome = document.getElementById('pessoaNome').value;
        const ativo = document.getElementById('pessoaAtivo').checked;
        if(!nome) return alert('Nome obrigatório');
        
        if(id) await window.pessoasDB.atualizar(id, {nome, ativo});
        else await window.pessoasDB.criar({nome, ativo});
        
        document.getElementById('modalPessoa').classList.add('hidden');
        carregarDados();
    };
}

// Helpers Visuais
window.abrirModalViagem = (id) => {
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemMotorista').value = '';
    document.getElementById('viagemValorPorPessoa').value = appState.config.valor_padrao; // Usa config do banco
    document.getElementById('viagemObservacao').value = '';

    // Checkboxes
    const container = document.getElementById('listaPassageirosCheckboxes');
    container.innerHTML = '';
    // Só mostra pessoas ativas no modal de viagem
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        container.innerHTML += `
            <label style="display:block; margin:5px 0;">
                <input type="checkbox" class="chk-passageiro" value="${p.id}" id="chk_${p.id}"> ${p.nome}
            </label>`;
    });

    // Motoristas Select
    const sel = document.getElementById('viagemMotorista');
    sel.innerHTML = '<option value="">Selecione...</option>';
    appState.pessoas.filter(p => p.ativo).forEach(p => sel.add(new Option(p.nome, p.id)));

    if(id) {
        // ... (Lógica de edição igual anterior) ...
        const v = appState.viagens.find(x => x.id == id);
        if(v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemObservacao').value = v.observacao || '';
            if(v.passageiros?.[0]) document.getElementById('viagemValorPorPessoa').value = v.passageiros[0].valor;
            v.passageiros?.forEach(p => {
                const el = document.getElementById(`chk_${p.pessoa_id}`);
                if(el) el.checked = true;
            });
        }
    }
    document.getElementById('modalViagem').classList.remove('hidden');
};

window.editarPessoa = (id) => {
    const p = appState.pessoas.find(x => x.id == id);
    document.getElementById('pessoaId').value = p.id;
    document.getElementById('pessoaNome').value = p.nome;
    document.getElementById('pessoaAtivo').checked = p.ativo;
    document.getElementById('modalPessoa').classList.remove('hidden');
};

window.excluirViagem = async (id) => {
    if(confirm('Excluir viagem?')) {
        await window.viagensDB.excluir(id);
        carregarDados();
    }
};

const fmtMoeda = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const fmtData = (d) => new Date(d+'T00:00:00').toLocaleDateString('pt-BR');
function mostrarLoading(show) { document.getElementById('loadingOverlay').classList.toggle('hidden', !show); }
