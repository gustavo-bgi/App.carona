// ============================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================
const appState = {
    mesAtual: new Date().getMonth() + 1,
    anoAtual: new Date().getFullYear(),
    pessoas: [],
    viagens: [],
    viagemEditando: null
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando App...');

    // 1. Verifica se db-config.js carregou
    if (typeof window.verificarConexao !== 'function') {
        alert('Erro: db-config.js não carregado corretamente. Verifique a pasta JS.');
        return;
    }

    // 2. Tenta Conectar
    const conectado = await window.verificarConexao();
    if (!conectado) {
        document.querySelector('main').innerHTML = '<div class="alert alert-danger">Erro de conexão com o Banco de Dados. Verifique o console.</div>';
        return;
    }

    // 3. Configurações Iniciais
    configurarSelecaoMes();
    configurarModais();
    
    // 4. Carrega Dados
    await carregarDados();
});

// ============================================
// CONTROLE DE DADOS
// ============================================

async function carregarDados() {
    mostrarLoading(true);
    try {
        console.log(`🔄 Carregando dados para ${appState.mesAtual}/${appState.anoAtual}...`);

        // A. Carregar Pessoas (CORREÇÃO DO ERRO .map)
        // Usamos desestruturação { data } para pegar o array de dentro do objeto de resposta
        const { data: pessoas, error: erroPessoas } = await window.pessoasDB.listar();
        if (erroPessoas) throw erroPessoas;
        appState.pessoas = pessoas || []; // Garante que é array

        // B. Carregar Viagens
        const { data: viagens, error: erroViagens } = await window.viagensDB.listar(appState.mesAtual, appState.anoAtual);
        if (erroViagens) throw erroViagens;
        appState.viagens = viagens || [];

        // C. Carregar Dashboard
        const stats = await window.estatisticasDB.obterDashboard(appState.mesAtual, appState.anoAtual);
        atualizarDashboard(stats);

        // D. Renderizar Tabelas
        renderizarTabelaPessoas();
        renderizarTabelaViagens();
        atualizarSelectMotoristas();

    } catch (err) {
        console.error('❌ Erro ao carregar dados:', err);
        alert('Erro ao carregar dados: ' + err.message);
    } finally {
        mostrarLoading(false);
    }
}

// ============================================
// RENDERIZAÇÃO (INTERFACE)
// ============================================

function atualizarDashboard(stats) {
    // Função segura para formatar moeda
    const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    document.getElementById('totalViagens').textContent = stats.totalViagens;
    document.getElementById('kmTotal').textContent = stats.kmTotal + ' km';
    document.getElementById('custoTotal').textContent = fmt(stats.custoTotal);
    document.getElementById('custoMedio').textContent = fmt(stats.custoMedio);
    
    // Atualiza título do mês
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('mesAtual').textContent = `${meses[appState.mesAtual - 1]} de ${appState.anoAtual}`;
}

function renderizarTabelaPessoas() {
    const tbody = document.querySelector('#tabelaPessoas tbody');
    tbody.innerHTML = '';

    // Aqui usamos o .map que estava dando erro. Agora appState.pessoas é um Array seguro.
    appState.pessoas.forEach(p => {
        // Calcula saldo (Isso deveria vir do banco, simplificado aqui)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.nome}</td>
            <td>${p.ativo ? '<span style="color:green">Ativo</span>' : '<span style="color:red">Inativo</span>'}</td>
            <td>--</td> <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirModalPessoa(${p.id})">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTabelaViagens() {
    const tbody = document.querySelector('#tabelaViagens tbody');
    tbody.innerHTML = '';

    if (appState.viagens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma viagem neste mês.</td></tr>';
        return;
    }

    appState.viagens.forEach(v => {
        const nomesPassageiros = v.passageiros 
            ? v.passageiros.map(p => p.pessoa?.nome || 'Desconhecido').join(', ') 
            : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${v.observacao || 'Sem descrição'}</td>
            <td>${v.motorista?.nome || 'N/A'}</td>
            <td><small>${nomesPassageiros}</small></td>
            <td>R$ ${parseFloat(v.valor_total).toFixed(2)}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirModalViagem(${v.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deletarViagem(${v.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarSelectMotoristas() {
    const select = document.getElementById('viagemMotorista');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    appState.pessoas
        .filter(p => p.ativo)
        .forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
        });
}

// ============================================
// FUNÇÕES DE AÇÃO (Salvar/Excluir)
// ============================================

// --- PESSOAS ---
window.abrirModalPessoa = (id = null) => {
    document.getElementById('pessoaId').value = id || '';
    document.getElementById('pessoaNome').value = '';
    document.getElementById('pessoaAtivo').checked = true;

    if (id) {
        const p = appState.pessoas.find(x => x.id === id);
        if (p) {
            document.getElementById('pessoaNome').value = p.nome;
            document.getElementById('pessoaAtivo').checked = p.ativo;
        }
    }
    document.getElementById('modalPessoa').classList.remove('hidden');
};

document.getElementById('btnSalvarPessoa').onclick = async () => {
    const id = document.getElementById('pessoaId').value;
    const nome = document.getElementById('pessoaNome').value;
    const ativo = document.getElementById('pessoaAtivo').checked;

    if (!nome) return alert('Nome é obrigatório');

    mostrarLoading(true);
    try {
        if (id) {
            await window.pessoasDB.atualizar(id, { nome, ativo });
        } else {
            await window.pessoasDB.criar({ nome, ativo });
        }
        document.getElementById('modalPessoa').classList.add('hidden');
        await carregarDados();
    } catch (e) {
        alert('Erro ao salvar: ' + e.message);
    } finally {
        mostrarLoading(false);
    }
};

// --- VIAGENS ---
window.abrirModalViagem = async (id = null) => {
    // Resetar form
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemMotorista').value = '';
    document.getElementById('viagemKm').value = '';
    document.getElementById('viagemValorTotal').value = '';
    document.getElementById('viagemObservacao').value = '';
    
    // Renderizar Checkboxes de Passageiros
    const container = document.getElementById('listaPassageirosCheckboxes');
    container.innerHTML = '';
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        container.innerHTML += `
            <div style="margin-bottom: 5px;">
                <input type="checkbox" id="pass_${p.id}" value="${p.id}" class="chk-passageiro">
                <label for="pass_${p.id}">${p.nome}</label>
            </div>
        `;
    });

    if (id) {
        // Preencher dados se for edição
        const v = appState.viagens.find(x => x.id == id); // == solto para pegar string/int
        if (v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemKm').value = v.km || 0;
            document.getElementById('viagemValorTotal').value = v.valor_total;
            document.getElementById('viagemObservacao').value = v.observacao || '';
            
            // Marcar passageiros
            if (v.passageiros) {
                v.passageiros.forEach(pass => {
                    const chk = document.getElementById(`pass_${pass.pessoa_id}`);
                    if (chk) chk.checked = true;
                });
            }
        }
    }
    
    document.getElementById('modalViagem').classList.remove('hidden');
};

document.getElementById('btnSalvarViagem').onclick = async () => {
    const id = document.getElementById('viagemId').value;
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const km = document.getElementById('viagemKm').value;
    const valor_total = document.getElementById('viagemValorTotal').value;
    const observacao = document.getElementById('viagemObservacao').value;

    if (!data || !motorista_id || !valor_total) return alert('Preencha os campos obrigatórios');

    // Coletar passageiros marcados
    const checkboxes = document.querySelectorAll('.chk-passageiro:checked');
    if (checkboxes.length === 0) return alert('Selecione pelo menos um passageiro (quem vai dividir a conta).');

    const valorPorPessoa = parseFloat(valor_total) / (checkboxes.length); // Divisão simples

    const passageiros = Array.from(checkboxes).map(chk => ({
        pessoa_id: chk.value,
        valor: valorPorPessoa,
        pago: false
    }));

    const viagemDados = { data, motorista_id, km, valor_total, observacao };

    mostrarLoading(true);
    try {
        if (id) {
            await window.viagensDB.atualizar(id, viagemDados, passageiros);
        } else {
            await window.viagensDB.criar(viagemDados, passageiros);
        }
        document.getElementById('modalViagem').classList.add('hidden');
        await carregarDados();
    } catch (e) {
        alert('Erro ao salvar viagem: ' + e.message);
        console.error(e);
    } finally {
        mostrarLoading(false);
    }
};

window.deletarViagem = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta viagem?')) return;
    mostrarLoading(true);
    try {
        await window.viagensDB.excluir(id);
        await carregarDados();
    } catch (e) {
        alert('Erro: ' + e.message);
    } finally {
        mostrarLoading(false);
    }
};

// ============================================
// UTILITÁRIOS INTERNOS
// ============================================

function configurarSelecaoMes() {
    const select = document.getElementById('mesSelecionado');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    select.innerHTML = '';
    meses.forEach((nome, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.text = nome;
        if (index + 1 === appState.mesAtual) option.selected = true;
        select.appendChild(option);
    });

    select.onchange = (e) => {
        appState.mesAtual = parseInt(e.target.value);
        carregarDados();
    };
}

function configurarModais() {
    // Botões para abrir modais
    document.getElementById('btnNovaPessoa').onclick = () => window.abrirModalPessoa();
    document.getElementById('btnNovaViagem').onclick = () => window.abrirModalViagem();

    // Botões de fechar (X e Cancelar)
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.onclick = (e) => {
            const modalId = e.target.getAttribute('data-modal');
            document.getElementById(modalId).classList.add('hidden');
        };
    });
}

function mostrarLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
}
