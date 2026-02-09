// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

// Formatar valor monetário
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Formatar data para exibição
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Formatar data para input
function formatarDataInput(data) {
    if (!data) return '';
    const d = new Date(data);
    return d.toISOString().split('T')[0];
}

// Obter data de hoje
function obterDataHoje() {
    return new Date().toISOString().split('T')[0];
}

// Obter nome do mês
function obterNomeMes(mes) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1];
}

// Obter nome do mês abreviado
function obterNomeMesAbreviado(mes) {
    const meses = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return meses[mes - 1];
}

// Gerar lista de meses para select
function gerarListaMeses() {
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1;
    const anoAtual = dataAtual.getFullYear();
    
    const meses = [];
    
    // Últimos 12 meses
    for (let i = 0; i < 12; i++) {
        let mes = mesAtual - i;
        let ano = anoAtual;
        
        if (mes <= 0) {
            mes += 12;
            ano -= 1;
        }
        
        meses.push({
            valor: `${ano}-${String(mes).padStart(2, '0')}`,
            texto: `${obterNomeMes(mes)} ${ano}`,
            mes: mes,
            ano: ano
        });
    }
    
    return meses;
}

// Obter mês e ano atual
function obterMesAnoAtual() {
    const data = new Date();
    return {
        mes: data.getMonth() + 1,
        ano: data.getFullYear()
    };
}

// Validar CPF (caso queira adicionar validação)
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
        soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

// Debounce para busca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Mostrar/Esconder loading
function mostrarLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.remove('hidden');
    }
}

function esconderLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.add('hidden');
    }
}

// Mostrar modal
function mostrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error('Modal não encontrado:', modalId);
    }
}

// Esconder modal
function esconderModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Mostrar toast/notificação
function mostrarNotificacao(mensagem, tipo = 'success') {
    // Criar elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao notificacao-${tipo}`;
    notificacao.textContent = mensagem;
    
    // Estilos inline (você pode mover para CSS)
    notificacao.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    
    document.body.appendChild(notificacao);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notificacao.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacao.remove(), 300);
    }, 3000);
}

// Adicionar animações ao CSS (se ainda não estiver)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Confirmar ação
function confirmarAcao(mensagem, callback) {
    const modal = document.getElementById('modalConfirmacao');
    const mensagemEl = document.getElementById('modalConfirmacaoMensagem');
    const btnConfirmar = document.getElementById('btnConfirmarAcao');
    
    mensagemEl.textContent = mensagem;
    mostrarModal('modalConfirmacao');
    
    // Remover listeners antigos
    const novoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtn, btnConfirmar);
    
    // Adicionar novo listener
    novoBtn.addEventListener('click', () => {
        esconderModal('modalConfirmacao');
        callback();
    });
}

// Validar formulário
function validarFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('[required]');
    let valido = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('input-error');
            valido = false;
        } else {
            input.classList.remove('input-error');
        }
    });
    
    return valido;
}

// Limpar formulário
function limparFormulario(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.reset();
    
    // Remover classes de erro
    form.querySelectorAll('.input-error').forEach(el => {
        el.classList.remove('input-error');
    });
    
    // Limpar campos hidden
    form.querySelectorAll('input[type="hidden"]').forEach(input => {
        input.value = '';
    });
}

// Criar elemento HTML de forma mais fácil
function createElement(tag, classes = '', content = '') {
    const element = document.createElement(tag);
    if (classes) element.className = classes;
    if (content) element.textContent = content;
    return element;
}

// Ordenar array de objetos
function ordenarPor(array, campo, ordem = 'asc') {
    return array.sort((a, b) => {
        const valorA = a[campo];
        const valorB = b[campo];
        
        if (ordem === 'asc') {
            return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
        } else {
            return valorA < valorB ? 1 : valorA > valorB ? -1 : 0;
        }
    });
}

// Agrupar array por campo
function agruparPor(array, campo) {
    return array.reduce((grupos, item) => {
        const chave = item[campo];
        if (!grupos[chave]) {
            grupos[chave] = [];
        }
        grupos[chave].push(item);
        return grupos;
    }, {});
}

// Calcular primeiro e último dia do mês
function obterPrimeiroDiaMes(mes, ano) {
    return new Date(ano, mes - 1, 1).toISOString().split('T')[0];
}

function obterUltimoDiaMes(mes, ano) {
    return new Date(ano, mes, 0).toISOString().split('T')[0];
}

// Exportar para CSV
function exportarParaCSV(dados, nomeArquivo) {
    if (!dados || dados.length === 0) {
        mostrarNotificacao('Nenhum dado para exportar', 'error');
        return;
    }
    
    // Obter cabeçalhos
    const headers = Object.keys(dados[0]);
    
    // Criar conteúdo CSV
    let csv = headers.join(',') + '\n';
    
    dados.forEach(row => {
        const values = headers.map(header => {
            const value = row[header];
            // Escapar vírgulas e aspas
            return typeof value === 'string' && value.includes(',') 
                ? `"${value.replace(/"/g, '""')}"` 
                : value;
        });
        csv += values.join(',') + '\n';
    });
    
    // Criar blob e download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Copiar para clipboard
async function copiarParaClipboard(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        mostrarNotificacao('Copiado para a área de transferência!', 'success');
    } catch (err) {
        mostrarNotificacao('Erro ao copiar', 'error');
    }
}

// Detectar se está em dispositivo móvel
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Scroll suave para elemento
function scrollParaElemento(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
