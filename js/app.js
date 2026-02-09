// ============================================
// ESTADO GLOBAL
// ============================================
const appState = {
    mesAtual: new Date().getMonth() + 1,
    anoAtual: new Date().getFullYear(),
    pessoas: [],
    viagens: [],
    saldos: [], // Dados vindos da View nova
    config: {
        valorPadrao: localStorage.getItem('valorPadraoCarona') || 5.00
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.verificarConexao !== 'function') return alert('Erro nos scripts.');
    if (!await window.verificarConexao()) return document.body.innerHTML = '<h1>Erro conexão banco</h1>';

    configurarInterface();
    await carregarDados();
});

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function carregarDados() {
    mostrarLoading(true);
    try {
        // 1. Carregar Pessoas
        const { data: pessoas } = await window.pessoasDB.listar();
        appState.pessoas = pessoas || [];

        // 2. Carregar Saldos (VIEW NOVA)
        const { data: saldos } = await window.saldosDB.listarAtuais();
        appState.saldos = saldos || [];

        // 3. Carregar Viagens do Mês
        const { data: viagens } = await window.viagensDB.listar(appState.mesAtual, appState.anoAtual);
        appState.viagens = viagens || [];

        renderizarTudo();
    } catch (err) {
        console.error(err);
        alert('Erro ao atualizar dados.');
    } finally {
        mostrarLoading(false);
    }
}

function renderizarTudo() {
    atualizarDashboard();
    renderizarTabelaPessoas();
    renderizarTabelaViagens();
    atualizarSelectMotoristas();
    atualizarResumoModal(); // Caso modal esteja aberto
}

// ============================================
// RENDERIZAÇÃO
// ============================================
function atualizarDashboard() {
    const fmt = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    
    // Total movimentado é a soma de todos os valores totais das viagens
    const totalMovimentado = appState.viagens.reduce((acc, v) => acc + (parseFloat(v.valor_total)||0), 0);

    document.getElementById('totalViagens').textContent = appState.viagens.length;
    document.getElementById('custoTotal').textContent = fmt(totalMovimentado);
    
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('mesAtual').textContent = `${meses[appState.mesAtual - 1]}/${appState.anoAtual}`;
}

function renderizarTabelaPessoas() {
    const tbody = document.querySelector('#tabelaPessoas tbody');
    tbody.innerHTML = '';
    const fmt = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    appState.saldos.forEach(s => {
        // Encontrar status ativo se necessário (trazido da view)
        const tr = document.createElement('tr');
        
        // Estilo condicional para saldo
        const saldoClass = s.saldo_liquido > 0 ? 'text-success' : (s.saldo_liquido < 0 ? 'text-danger' : '');
        const saldoSinal = s.saldo_liquido > 0 ? '+' : '';

        tr.innerHTML = `
            <td><strong>${s.nome}</strong></td>
            <td class="text-right" style="color: #ef4444">${fmt(s.a_pagar)}</td>
            <td class="text-right" style="color: #10b981">${fmt(s.a_receber)}</td>
            <td class="text-right ${saldoClass}" style="font-weight: bold">
                ${saldoSinal}${fmt(s.saldo_liquido)}
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirModalPessoa(${s.id})">✏️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTabelaViagens() {
    const tbody = document.querySelector('#tabelaViagens tbody');
    tbody.innerHTML = '';
    const fmt = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    if (!appState.viagens.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma viagem encontrada.</td></tr>';
        return;
    }

    appState.viagens.forEach(v => {
        // Descobre valor unitário pegando o primeiro passageiro (assumindo valor igual pra todos)
        const valorUnitario = v.passageiros && v.passageiros.length > 0 
            ? v.passageiros[0].valor 
            : 0;

        const nomesPassageiros = v.passageiros 
            ? v.passageiros.map(p => p.pessoa?.nome || '?').join(', ') 
            : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${v.motorista?.nome || 'N/A'}</td>
            <td><small>${nomesPassageiros}</small></td>
            <td>${fmt(valorUnitario)}</td>
            <td><strong>${fmt(v.valor_total)}</strong></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirModalViagem(${v.id})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deletarViagem(${v.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// LÓGICA DE VIAGEM E CÁLCULOS
// ============================================

// Monitora mudanças no modal para recalcular totais em tempo real
function atualizarResumoModal() {
    const valorPorPessoa = parseFloat(document.getElementById('viagemValorPorPessoa').value) || 0;
    const selecionados = document.querySelectorAll('.chk-passageiro:checked').length;
    const totalMotorista = valorPorPessoa * selecionados;
    
    const div = document.getElementById('resumoViagem');
    div.innerHTML = `
        <strong>Resumo:</strong><br>
        ${selecionados} Passageiro(s) x R$ ${valorPorPessoa.toFixed(2)}<br>
        <strong>Total para o Motorista: R$ ${totalMotorista.toFixed(2)}</strong>
    `;
}

window.abrirModalViagem = async (id = null) => {
    // Resetar campos
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemData').value = new Date().toISOString().split('T')[0];
    document.getElementById('viagemMotorista').value = '';
    
    // Valor padrão (Configuração ou Edição)
    document.getElementById('viagemValorPorPessoa').value = appState.config.valorPadrao;
    document.getElementById('viagemObservacao').value = '';

    // Renderizar Passageiros
    const container = document.getElementById('listaPassageirosCheckboxes');
    container.innerHTML = '';
    appState.pessoas.filter(p => p.ativo).forEach(p => {
        container.innerHTML += `
            <div style="margin-bottom: 5px;">
                <input type="checkbox" id="pass_${p.id}" value="${p.id}" class="chk-passageiro" onchange="atualizarResumoModal()">
                <label for="pass_${p.id}">${p.nome}</label>
            </div>
        `;
    });

    // Se for edição, preencher
    if (id) {
        const v = appState.viagens.find(x => x.id == id);
        if (v) {
            document.getElementById('viagemData').value = v.data;
            document.getElementById('viagemMotorista').value = v.motorista_id;
            document.getElementById('viagemObservacao').value = v.observacao || '';
            
            // Valor Unitário (pega do primeiro passageiro)
            if (v.passageiros && v.passageiros.length > 0) {
                document.getElementById('viagemValorPorPessoa').value = v.passageiros[0].valor;
            }

            // Marcar passageiros
            v.passageiros?.forEach(p => {
                const chk = document.getElementById(`pass_${p.pessoa_id}`);
                if (chk) chk.checked = true;
            });
        }
    }
    
    atualizarResumoModal();
    document.getElementById('modalViagem').classList.remove('hidden');
    
    // Adiciona listener para recalcular ao mudar valor
    document.getElementById('viagemValorPorPessoa').oninput = atualizarResumoModal;
};

document.getElementById('btnSalvarViagem').onclick = async () => {
    const id = document.getElementById('viagemId').value;
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const valorUnitario = parseFloat(document.getElementById('viagemValorPorPessoa').value);
    const observacao = document.getElementById('viagemObservacao').value;

    if (!motorista_id || !valorUnitario) return alert('Motorista e Valor são obrigatórios.');

    const checkboxes = document.querySelectorAll('.chk-passageiro:checked');
    if (checkboxes.length === 0) return alert('Selecione ao menos um passageiro.');

    // NOVO CÁLCULO: Valor por pessoa é fixo, total é a soma
    const valorTotalViagem = valorUnitario * checkboxes.length;

    // Se motorista estiver marcado como passageiro também, é estranho, mas permitimos (ele paga pra ele mesmo?)
    // Idealmente, desmarcaríamos o motorista da lista de passageiros, mas deixarei flexível.

    const passageiros = Array.from(checkboxes).map(chk => ({
        pessoa_id: chk.value,
        valor: valorUnitario,
        pago: false
    }));

    const dadosViagem = { data, motorista_id, valor_total: valorTotalViagem, observacao };

    mostrarLoading(true);
    try {
        if (id) await window.viagensDB.atualizar(id, dadosViagem, passageiros);
        else await window.viagensDB.criar(dadosViagem, passageiros);
        
        document.getElementById('modalViagem').classList.add('hidden');
        await carregarDados();
    } catch (e) { alert(e.message); } 
    finally { mostrarLoading(false); }
};

window.deletarViagem = async (id) => {
    if(confirm('Excluir viagem?')) {
        mostrarLoading(true);
        await window.viagensDB.excluir(id);
        await carregarDados();
        mostrarLoading(false);
    }
};

// ============================================
// CONFIGURAÇÃO E UTILS
// ============================================
function configurarInterface() {
    // Configura Mês Selector
    const sel = document.getElementById('mesSelecionado');
    sel.innerHTML = '';
    ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    .forEach((m, i) => sel.add(new Option(m, i+1, i+1 === appState.mesAtual, i+1 === appState.mesAtual)));
    
    sel.onchange = (e) => {
        appState.mesAtual = parseInt(e.target.value);
        carregarDados();
    };

    // Botão e Modal de Config
    document.getElementById('btnConfig').onclick = () => {
        document.getElementById('configValorPadrao').value = appState.config.valorPadrao;
        document.getElementById('modalConfig').classList.remove('hidden');
    };
    
    document.getElementById('btnSalvarConfig').onclick = () => {
        const novoValor = document.getElementById('configValorPadrao').value;
        if(novoValor) {
            localStorage.setItem('valorPadraoCarona', novoValor);
            appState.config.valorPadrao = novoValor;
            alert('Configuração salva!');
            document.getElementById('modalConfig').classList.add('hidden');
        }
    };

    // Botões Padrões
    document.getElementById('btnNovaViagem').onclick = () => window.abrirModalViagem();
    document.getElementById('btnNovaPessoa').onclick = () => abrirModalPessoa();
    document.querySelectorAll('.modal-close, [data-modal]').forEach(b => {
        b.onclick = (e) => {
            const id = e.target.getAttribute('data-modal') || e.target.closest('.modal').id;
            document.getElementById(id).classList.add('hidden');
        };
    });

    // Pessoas
    window.abrirModalPessoa = (id) => {
        document.getElementById('pessoaId').value = id || '';
        document.getElementById('pessoaNome').value = id ? appState.pessoas.find(p=>p.id==id).nome : '';
        document.getElementById('modalPessoa').classList.remove('hidden');
    };

    document.getElementById('btnSalvarPessoa').onclick = async () => {
        const id = document.getElementById('pessoaId').value;
        const nome = document.getElementById('pessoaNome').value;
        const ativo = document.getElementById('pessoaAtivo').checked;
        if(!nome) return alert('Nome obrigatório');
        
        mostrarLoading(true);
        if(id) await window.pessoasDB.atualizar(id, {nome, ativo});
        else await window.pessoasDB.criar({nome, ativo});
        
        document.getElementById('modalPessoa').classList.add('hidden');
        await carregarDados();
        mostrarLoading(false);
    };
}

function atualizarSelectMotoristas() {
    const sel = document.getElementById('viagemMotorista');
    const valorAtual = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>';
    appState.pessoas.filter(p=>p.ativo).forEach(p => {
        sel.add(new Option(p.nome, p.id));
    });
    sel.value = valorAtual;
}

function mostrarLoading(show) {
    const ov = document.getElementById('loadingOverlay');
    show ? ov.classList.remove('hidden') : ov.classList.add('hidden');
}
