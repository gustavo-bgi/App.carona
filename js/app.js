// ============================================
// APLICAÇÃO PRINCIPAL - CONTROLE DE CARONAS
// ============================================

// Estado da aplicação
const appState = {
    mesAtual: null,
    anoAtual: null,
    pessoas: [],
    viagens: [],
    saldos: [],
    viagemEditando: null,
    pessoaEditando: null
};

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar conexão com Supabase
    const conectado = await verificarConexao();
    if (!conectado) {
        esconderLoading();
        return;
    }
    
    // Configurar mês atual
    const { mes, ano } = obterMesAnoAtual();
    appState.mesAtual = mes;
    appState.anoAtual = ano;
    
    // Inicializar interface
    inicializarEventListeners();
    await carregarDadosIniciais();
    
    esconderLoading();
});

// ============================================
// CARREGAR DADOS
// ============================================

async function carregarDadosIniciais() {
    try {
        mostrarLoading();
        
        // Preencher seletores de mês
        preencherSeletoresMes();
        
        // Atualizar mês atual no título
        atualizarTituloMesAtual();
        
        // Carregar dados do dashboard
        await carregarDashboard();
        
        // Carregar pessoas
        await carregarPessoas();
        
        // Carregar viagens
        await carregarViagens();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados', 'error');
    } finally {
        esconderLoading();
    }
}

async function carregarDashboard() {
    try {
        const stats = await estatisticasDB.obterDashboard(appState.mesAtual, appState.anoAtual);
        
        // Atualizar estatísticas
        document.getElementById('totalViagens').textContent = stats.totalViagens;
        document.getElementById('totalMovimentado').textContent = formatarMoeda(stats.totalMovimentado);
        document.getElementById('pessoasAtivas').textContent = stats.pessoasAtivas;
        
        // Atualizar saldos
        appState.saldos = stats.saldos;
        renderizarSaldos(stats.saldos);
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        throw error;
    }
}

async function carregarPessoas() {
    try {
        appState.pessoas = await pessoasDB.listar(false); // Incluir inativos
        renderizarPessoas();
        atualizarSeletoresPessoas();
    } catch (error) {
        console.error('Erro ao carregar pessoas:', error);
        throw error;
    }
}

async function carregarViagens() {
    try {
        appState.viagens = await viagensDB.listar(appState.mesAtual, appState.anoAtual);
        renderizarViagens();
    } catch (error) {
        console.error('Erro ao carregar viagens:', error);
        throw error;
    }
}

// ============================================
// RENDERIZAÇÃO
// ============================================

function renderizarSaldos(saldos) {
    const container = document.getElementById('saldosContainer');
    
    if (!saldos || saldos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <div class="empty-state-text">Nenhum saldo para exibir</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = saldos.map(saldo => {
        const saldoValor = parseFloat(saldo.saldo);
        const classe = saldoValor > 0 ? 'positivo' : saldoValor < 0 ? 'negativo' : 'neutro';
        
        return `
            <div class="saldo-item ${classe}">
                <div class="saldo-nome">${saldo.nome}</div>
                <div class="saldo-detalhes">
                    <span style="color: var(--success)">↑ ${formatarMoeda(saldo.recebido)}</span>
                    <span style="color: var(--danger)">↓ ${formatarMoeda(saldo.pago)}</span>
                    <span class="saldo-valor ${classe}">${formatarMoeda(saldoValor)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarViagens() {
    const container = document.getElementById('viagensLista');
    
    if (!appState.viagens || appState.viagens.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <div class="empty-state-text">Nenhuma viagem registrada neste mês</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.viagens.map(viagem => `
        <div class="viagem-card" data-id="${viagem.id}">
            <div class="viagem-header">
                <div class="viagem-data">📅 ${formatarData(viagem.data)}</div>
                <div class="viagem-valor">${formatarMoeda(viagem.valor_total)}</div>
            </div>
            
            <div class="viagem-info">
                <div class="viagem-motorista">
                    <strong>Motorista:</strong> 
                    <span>${viagem.motorista}</span>
                </div>
                
                <div class="viagem-passageiros">
                    <strong>Passageiros (${viagem.num_passageiros}):</strong>
                    <span class="viagem-passageiros-lista">${viagem.passageiros || 'Nenhum'}</span>
                </div>
                
                ${viagem.observacao ? `
                    <div class="viagem-observacao">
                        💬 ${viagem.observacao}
                    </div>
                ` : ''}
            </div>
            
            <div class="viagem-acoes">
                <button class="btn btn-icon" onclick="editarViagem('${viagem.id}')" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-icon" onclick="excluirViagem('${viagem.id}')" title="Excluir">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function renderizarPessoas() {
    const container = document.getElementById('pessoasLista');
    
    if (!appState.pessoas || appState.pessoas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-text">Nenhuma pessoa cadastrada</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appState.pessoas.map(pessoa => `
        <div class="pessoa-card" data-id="${pessoa.id}">
            <div class="pessoa-info">
                <div class="pessoa-nome">${pessoa.nome}</div>
                <span class="pessoa-status ${pessoa.ativo ? 'ativo' : 'inativo'}">
                    ${pessoa.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            
            <div class="pessoa-acoes">
                <button class="btn btn-icon" onclick="editarPessoa('${pessoa.id}')" title="Editar">
                    ✏️
                </button>
                <button class="btn btn-icon" onclick="excluirPessoa('${pessoa.id}')" title="Excluir">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// PESSOAS - CRUD
// ============================================

function novaPessoa() {
    appState.pessoaEditando = null;
    document.getElementById('modalPessoaTitulo').textContent = 'Nova Pessoa';
    document.getElementById('pessoaId').value = '';
    document.getElementById('pessoaNome').value = '';
    document.getElementById('pessoaAtiva').checked = true;
    mostrarModal('modalPessoa');
}

async function editarPessoa(id) {
    try {
        mostrarLoading();
        const pessoa = await pessoasDB.buscarPorId(id);
        
        appState.pessoaEditando = pessoa;
        document.getElementById('modalPessoaTitulo').textContent = 'Editar Pessoa';
        document.getElementById('pessoaId').value = pessoa.id;
        document.getElementById('pessoaNome').value = pessoa.nome;
        document.getElementById('pessoaAtiva').checked = pessoa.ativo;
        
        mostrarModal('modalPessoa');
        
    } catch (error) {
        console.error('Erro ao editar pessoa:', error);
        mostrarNotificacao('Erro ao carregar pessoa', 'error');
    } finally {
        esconderLoading();
    }
}

async function salvarPessoa() {
    try {
        const nome = document.getElementById('pessoaNome').value.trim();
        const ativo = document.getElementById('pessoaAtiva').checked;
        const id = document.getElementById('pessoaId').value;
        
        if (!nome) {
            mostrarNotificacao('Por favor, preencha o nome', 'error');
            return;
        }
        
        mostrarLoading();
        
        const pessoa = { nome, ativo };
        
        if (id) {
            // Atualizar
            await pessoasDB.atualizar(id, pessoa);
            mostrarNotificacao('Pessoa atualizada com sucesso!', 'success');
        } else {
            // Criar
            await pessoasDB.criar(pessoa);
            mostrarNotificacao('Pessoa criada com sucesso!', 'success');
        }
        
        esconderModal('modalPessoa');
        await carregarPessoas();
        await carregarDashboard();
        
    } catch (error) {
        console.error('Erro ao salvar pessoa:', error);
        mostrarNotificacao('Erro ao salvar pessoa', 'error');
    } finally {
        esconderLoading();
    }
}

async function excluirPessoa(id) {
    confirmarAcao('Tem certeza que deseja excluir esta pessoa? Esta ação não pode ser desfeita.', async () => {
        try {
            mostrarLoading();
            await pessoasDB.excluir(id);
            mostrarNotificacao('Pessoa excluída com sucesso!', 'success');
            await carregarPessoas();
            await carregarDashboard();
        } catch (error) {
            console.error('Erro ao excluir pessoa:', error);
            mostrarNotificacao('Erro ao excluir pessoa. Verifique se não há viagens vinculadas.', 'error');
        } finally {
            esconderLoading();
        }
    });
}

// ============================================
// VIAGENS - CRUD
// ============================================

function novaViagem() {
    appState.viagemEditando = null;
    document.getElementById('modalViagemTitulo').textContent = 'Nova Viagem';
    document.getElementById('viagemId').value = '';
    document.getElementById('viagemData').value = obterDataHoje();
    document.getElementById('viagemMotorista').value = '';
    document.getElementById('viagemValorTotal').value = '';
    document.getElementById('viagemObservacao').value = '';
    
    renderizarPassageirosCheckboxes();
    mostrarModal('modalViagem');
}

async function editarViagem(id) {
    try {
        mostrarLoading();
        const viagem = await viagensDB.buscarPorId(id);
        
        appState.viagemEditando = viagem;
        document.getElementById('modalViagemTitulo').textContent = 'Editar Viagem';
        document.getElementById('viagemId').value = viagem.id;
        document.getElementById('viagemData').value = formatarDataInput(viagem.data);
        document.getElementById('viagemMotorista').value = viagem.motorista_id;
        document.getElementById('viagemValorTotal').value = viagem.valor_total;
        document.getElementById('viagemObservacao').value = viagem.observacao || '';
        
        renderizarPassageirosCheckboxes(viagem.passageiros);
        mostrarModal('modalViagem');
        
    } catch (error) {
        console.error('Erro ao editar viagem:', error);
        mostrarNotificacao('Erro ao carregar viagem', 'error');
    } finally {
        esconderLoading();
    }
}

function renderizarPassageirosCheckboxes(passageirosSelecionados = []) {
    const container = document.getElementById('passageirosContainer');
    const motorista = document.getElementById('viagemMotorista').value;
    const valorTotal = parseFloat(document.getElementById('viagemValorTotal').value) || 0;
    
    // Filtrar motorista da lista
    const pessoasDisponiveis = appState.pessoas.filter(p => p.ativo && p.id !== motorista);
    
    if (pessoasDisponiveis.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">Selecione um motorista primeiro</div>
            </div>
        `;
        return;
    }
    
    // IDs dos passageiros selecionados
    const idsPassageiros = passageirosSelecionados.map(p => p.passageiro_id);
    
    // Calcular valor por passageiro
    const numSelecionados = idsPassageiros.length || 1;
    const valorPorPassageiro = valorTotal / numSelecionados;
    
    container.innerHTML = pessoasDisponiveis.map(pessoa => {
        const selecionado = idsPassageiros.includes(pessoa.id);
        return `
            <div class="passageiro-item">
                <label>
                    <input 
                        type="checkbox" 
                        name="passageiros" 
                        value="${pessoa.id}"
                        ${selecionado ? 'checked' : ''}
                        onchange="atualizarValoresPassageiros()"
                    >
                    <span>${pessoa.nome}</span>
                </label>
                <span class="passageiro-valor">${formatarMoeda(valorPorPassageiro)}</span>
            </div>
        `;
    }).join('');
}

function atualizarValoresPassageiros() {
    const valorTotal = parseFloat(document.getElementById('viagemValorTotal').value) || 0;
    const checkboxes = document.querySelectorAll('input[name="passageiros"]:checked');
    const numPassageiros = checkboxes.length || 1;
    const valorPorPassageiro = valorTotal / numPassageiros;
    
    document.querySelectorAll('.passageiro-valor').forEach(el => {
        el.textContent = formatarMoeda(valorPorPassageiro);
    });
}

async function salvarViagem() {
    try {
        const data = document.getElementById('viagemData').value;
        const motoristaId = document.getElementById('viagemMotorista').value;
        const valorTotal = parseFloat(document.getElementById('viagemValorTotal').value);
        const observacao = document.getElementById('viagemObservacao').value.trim();
        const id = document.getElementById('viagemId').value;
        
        // Validações
        if (!data || !motoristaId || !valorTotal) {
            mostrarNotificacao('Por favor, preencha todos os campos obrigatórios', 'error');
            return;
        }
        
        if (valorTotal <= 0) {
            mostrarNotificacao('O valor deve ser maior que zero', 'error');
            return;
        }
        
        // Pegar passageiros selecionados
        const checkboxes = document.querySelectorAll('input[name="passageiros"]:checked');
        
        if (checkboxes.length === 0) {
            mostrarNotificacao('Selecione pelo menos um passageiro', 'error');
            return;
        }
        
        const valorPorPassageiro = valorTotal / checkboxes.length;
        const passageiros = Array.from(checkboxes).map(cb => ({
            passageiro_id: cb.value,
            valor_individual: valorPorPassageiro
        }));
        
        mostrarLoading();
        
        const viagem = {
            data,
            motorista_id: motoristaId,
            valor_total: valorTotal,
            observacao: observacao || null
        };
        
        if (id) {
            // Atualizar
            await viagensDB.atualizar(id, viagem, passageiros);
            mostrarNotificacao('Viagem atualizada com sucesso!', 'success');
        } else {
            // Criar
            await viagensDB.criar(viagem, passageiros);
            mostrarNotificacao('Viagem criada com sucesso!', 'success');
        }
        
        esconderModal('modalViagem');
        await carregarViagens();
        await carregarDashboard();
        
    } catch (error) {
        console.error('Erro ao salvar viagem:', error);
        mostrarNotificacao('Erro ao salvar viagem', 'error');
    } finally {
        esconderLoading();
    }
}

async function excluirViagem(id) {
    confirmarAcao('Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.', async () => {
        try {
            mostrarLoading();
            await viagensDB.excluir(id);
            mostrarNotificacao('Viagem excluída com sucesso!', 'success');
            await carregarViagens();
            await carregarDashboard();
        } catch (error) {
            console.error('Erro ao excluir viagem:', error);
            mostrarNotificacao('Erro ao excluir viagem', 'error');
        } finally {
            esconderLoading();
        }
    });
}

// ============================================
// RELATÓRIOS
// ============================================

async function gerarRelatorio() {
    try {
        const select = document.getElementById('relatorioMes');
        const [ano, mes] = select.value.split('-');
        
        mostrarLoading();
        
        // Buscar fechamento se existir
        const fechamento = await fechamentosDB.buscarPorMesAno(parseInt(mes), parseInt(ano));
        
        // Buscar viagens do período
        const viagens = await viagensDB.listar(parseInt(mes), parseInt(ano));
        
        // Calcular totais
        const totalViagens = viagens.length;
        const totalMovimentado = viagens.reduce((sum, v) => sum + parseFloat(v.valor_total), 0);
        
        // Renderizar relatório
        const container = document.getElementById('relatorioContainer');
        
        container.innerHTML = `
            <div class="relatorio-header">
                <h3>Relatório Mensal</h3>
                <div class="relatorio-periodo">${obterNomeMes(parseInt(mes))} ${ano}</div>
            </div>
            
            <div class="relatorio-resumo">
                <div class="relatorio-stat">
                    <div class="relatorio-stat-label">Total de Viagens</div>
                    <div class="relatorio-stat-value">${totalViagens}</div>
                </div>
                <div class="relatorio-stat">
                    <div class="relatorio-stat-label">Total Movimentado</div>
                    <div class="relatorio-stat-value">${formatarMoeda(totalMovimentado)}</div>
                </div>
                <div class="relatorio-stat">
                    <div class="relatorio-stat-label">Média por Viagem</div>
                    <div class="relatorio-stat-value">${formatarMoeda(totalViagens > 0 ? totalMovimentado / totalViagens : 0)}</div>
                </div>
            </div>
            
            ${fechamento ? `
                <h4 style="margin: 2rem 0 1rem 0;">Saldos do Fechamento</h4>
                <table class="relatorio-tabela">
                    <thead>
                        <tr>
                            <th>Pessoa</th>
                            <th style="text-align: right;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fechamento.fechamentos_saldos
                            .sort((a, b) => parseFloat(b.saldo) - parseFloat(a.saldo))
                            .map(s => `
                                <tr>
                                    <td>${s.pessoas.nome}</td>
                                    <td style="text-align: right; font-weight: 600; color: ${parseFloat(s.saldo) >= 0 ? 'var(--success)' : 'var(--danger)'}">
                                        ${formatarMoeda(s.saldo)}
                                    </td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>
            ` : `
                <div class="alert alert-info">
                    Este mês ainda não foi fechado. Os saldos são preliminares.
                </div>
            `}
            
            <h4 style="margin: 2rem 0 1rem 0;">Viagens do Período</h4>
            <table class="relatorio-tabela">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Motorista</th>
                        <th>Passageiros</th>
                        <th style="text-align: right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${viagens.length > 0 ? viagens.map(v => `
                        <tr>
                            <td>${formatarData(v.data)}</td>
                            <td>${v.motorista}</td>
                            <td>${v.passageiros || '-'}</td>
                            <td style="text-align: right;">${formatarMoeda(v.valor_total)}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="4" style="text-align: center; color: var(--text-secondary);">
                                Nenhuma viagem neste período
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        `;
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        mostrarNotificacao('Erro ao gerar relatório', 'error');
    } finally {
        esconderLoading();
    }
}

// ============================================
// FECHAMENTO MENSAL
// ============================================

async function fecharMes() {
    const mesNome = obterNomeMes(appState.mesAtual);
    
    confirmarAcao(
        `Deseja fechar o mês de ${mesNome} ${appState.anoAtual}?\n\nEsta ação registrará os saldos finais e não poderá ser desfeita.`,
        async () => {
            try {
                mostrarLoading();
                
                // Verificar se já existe fechamento
                const fechamentoExistente = await fechamentosDB.buscarPorMesAno(appState.mesAtual, appState.anoAtual);
                
                if (fechamentoExistente) {
                    mostrarNotificacao('Este mês já foi fechado anteriormente', 'error');
                    return;
                }
                
                // Realizar fechamento
                await fechamentosDB.realizar(appState.mesAtual, appState.anoAtual);
                
                mostrarNotificacao(`Mês de ${mesNome} ${appState.anoAtual} fechado com sucesso!`, 'success');
                
                // Recarregar dashboard
                await carregarDashboard();
                
            } catch (error) {
                console.error('Erro ao fechar mês:', error);
                mostrarNotificacao('Erro ao fechar mês', 'error');
            } finally {
                esconderLoading();
            }
        }
    );
}

// ============================================
// HELPERS DE UI
// ============================================

function preencherSeletoresMes() {
    const meses = gerarListaMeses();
    
    // Seletor do header
    const selectHeader = document.getElementById('mesSelecionado');
    selectHeader.innerHTML = meses.map(m => 
        `<option value="${m.valor}" ${m.mes === appState.mesAtual && m.ano === appState.anoAtual ? 'selected' : ''}>
            ${m.texto}
        </option>`
    ).join('');
    
    // Seletor de relatório
    const selectRelatorio = document.getElementById('relatorioMes');
    selectRelatorio.innerHTML = meses.map(m => 
        `<option value="${m.valor}">${m.texto}</option>`
    ).join('');
}

function atualizarTituloMesAtual() {
    const mesNome = obterNomeMes(appState.mesAtual);
    document.getElementById('mesAtual').textContent = `${mesNome} ${appState.anoAtual}`;
}

function atualizarSeletoresPessoas() {
    const pessoas = appState.pessoas.filter(p => p.ativo);
    
    const selectMotorista = document.getElementById('viagemMotorista');
    selectMotorista.innerHTML = '<option value="">Selecione...</option>' +
        pessoas.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

async function mudarMes(evento) {
    const [ano, mes] = evento.target.value.split('-');
    appState.mesAtual = parseInt(mes);
    appState.anoAtual = parseInt(ano);
    
    atualizarTituloMesAtual();
    await carregarDadosIniciais();
}

// ============================================
// EVENT LISTENERS
// ============================================

function inicializarEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            
            // Atualizar botões
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Atualizar conteúdo
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
        });
    });
    
    // Botões principais
    document.getElementById('btnNovaPessoa').addEventListener('click', novaPessoa);
    document.getElementById('btnSalvarPessoa').addEventListener('click', salvarPessoa);
    
    document.getElementById('btnNovaViagem').addEventListener('click', novaViagem);
    document.getElementById('btnSalvarViagem').addEventListener('click', salvarViagem);
    
    document.getElementById('btnFecharMes').addEventListener('click', fecharMes);
    document.getElementById('btnGerarRelatorio').addEventListener('click', gerarRelatorio);
    
    // Mudança de mês
    document.getElementById('mesSelecionado').addEventListener('change', mudarMes);
    
    // Fechar modais
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.getAttribute('data-modal');
            if (modalId) esconderModal(modalId);
        });
    });
    
    // Fechar modal ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // Atualizar checkboxes quando mudar motorista ou valor
    document.getElementById('viagemMotorista').addEventListener('change', () => {
        renderizarPassageirosCheckboxes();
    });
    
    document.getElementById('viagemValorTotal').addEventListener('input', () => {
        atualizarValoresPassageiros();
    });
}

// ============================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================

window.novaPessoa = novaPessoa;
window.editarPessoa = editarPessoa;
window.excluirPessoa = excluirPessoa;
window.novaViagem = novaViagem;
window.editarViagem = editarViagem;
window.excluirViagem = excluirViagem;
window.atualizarValoresPassageiros = atualizarValoresPassageiros;
