const appState = {
    config: { mes_atual: 2, ano_atual: 2026, valor_padrao: 8 },
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
    } catch(e) { console.error("Erro ao iniciar:", e); }
});

// --- FUNÇÃO NOVA: GARANTE DATA DO BRASIL ---
function dataHojeBrasil() {
    // O formato 'en-CA' retorna sempre YYYY-MM-DD, perfeito para inputs de data
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function carregarDados() {
    mostrarLoading(true);
    try {
        const { data: p } = await window.pessoasDB.listar();
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno);
        const { data: s } = await window.saldosDB.listarAtuais();
        
        appState.pessoas = p || [];
        appState.viagens = v || [];
        
        appState.saldos = s.map(pessoa => {
            let pag = 0; let rec = 0;
            appState.viagens.forEach(via => {
                if (via.motorista_id === pessoa.id) {
                    rec += via.passageiros.reduce((acc, pass) => acc + parseFloat(pass.valor), 0);
                }
                const souPass = via.passageiros.find(pass => pass.pessoa_id === pessoa.id);
                if (souPass) pag += parseFloat(souPass.valor);
            });
            return { ...pessoa, a_pagar: pag, a_receber: rec, saldo_liq: rec - pag };
        });
        renderizar();
    } catch(e) { console.error(e); }
    finally { mostrarLoading(false); }
}

function renderizar() {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    document.getElementById('labelMes').innerText = `${meses[appState.filtroMes-1]}/${appState.filtroAno}`;
    document.getElementById('totalViagens').innerText = appState.viagens.length;

    const tbS = document.querySelector('#tabelaPessoas tbody'); tbS.innerHTML = '';
    appState.saldos.filter(x => x.ativo || appState.isAdmin).forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.nome}</td><td class="text-right text-danger">${fmtMoeda(s.a_pagar)}</td><td class="text-right text-success">${fmtMoeda(s.a_receber)}</td><td class="text-right font-bold ${s.saldo_liq >= 0 ? 'text-success' : 'text-danger'}">${fmtMoeda(s.saldo_liq)}</td>`;
        tbS.appendChild(tr);
    });

    const tbV = document.querySelector('#tabelaViagens tbody'); tbV.innerHTML = '';
    appState.viagens.forEach(v => {
        const tr = document.createElement('tr');
        const podeEditar = (appState.filtroMes === appState.config.mes_atual && appState.filtroAno === appState.config.ano_atual);
        
        // CORREÇÃO VISUAL DA DATA NA TABELA (Para não mostrar dia anterior)
        const partesData = v.data.split('-'); // [2026, 02, 09]
        const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;

        tr.innerHTML = `
            <td>${dataFormatada}</td>
            <td>${v.motorista?.nome || '?'}</td>
            <td class="text-right">${fmtMoeda(v.valor_total)}</td>
            <td class="admin-only" style="text-align:center;">
                ${podeEditar ? `<button class="btn btn-secondary btn-sm" onclick="window.abrirModalViagem(${v.id})">✏️</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button>
            </td>`;
        tbV.appendChild(tr);
    });
    popularSelect();
    document.body.classList.toggle('modo-admin-ativo', appState.isAdmin);
}

function configurarInterface() {
    document.getElementById('btnNovaViagem').onclick = () => window.abrirModalViagem();
    
    // TRAVA MOTORISTA
    document.getElementById('viagemMotorista').onchange = (e) => {
        const motId = e.target.value;
        document.querySelectorAll('.chk-pass').forEach(chk => {
            if(chk.value === motId) { chk.checked = false; chk.disabled = true; chk.parentElement.style.opacity="0.4"; }
            else { chk.disabled = false; chk.parentElement.style.opacity="1"; }
        });
    };

    document.getElementById('btnToggleAdmin').onclick = () => {
        appState.isAdmin = !appState.isAdmin;
        localStorage.setItem('modoAdmin', appState.isAdmin);
        renderizar();
    };

    document.querySelectorAll('.modal-close').forEach(b => b.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')));
    document.getElementById('btnSalvarViagem').onclick = salvarViagem;
    document.getElementById('btnNovaPessoa').onclick = () => document.getElementById('modalPessoa').classList.remove('hidden');
    document.getElementById('btnSalvarPessoa').onclick = salvarPessoa;
    
    // BOTÃO ADMIN CORRIGIDO
    document.getElementById('btnAdminPanel').onclick = () => {
        document.getElementById('configValorPadrao').value = appState.config.valor_padrao;
        const lista = document.getElementById('listaUsuariosAdmin'); lista.innerHTML = '';
        appState.pessoas.forEach(p => {
            lista.innerHTML += `<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee"><span>${p.nome}</span><button class="btn btn-sm ${p.ativo?'btn-danger':'btn-primary'}" onclick="window.toggleAtivo(${p.id},${p.ativo})">${p.ativo?'Inativar':'Ativar'}</button></div>`;
        });
        document.getElementById('modalAdmin').classList.remove('hidden');
    };
    
    document.getElementById('btnSalvarConfig').onclick = salvarConfig;
    document.getElementById('btnFecharMes').onclick = fecharMes;
    document.getElementById('mesSelecionado').onchange = (e) => {
        const [m, a] = e.target.value.split('-');
        appState.filtroMes = parseInt(m); appState.filtroAno = parseInt(a);
        carregarDados();
    };
}

window.abrirModalViagem = (id = null) => {
    document.getElementById('viagemId').value = id || '';
    document.getElementById('viagemValorUnit').value = appState.config.valor_padrao;
    
    const selMot = document.getElementById('viagemMotorista');
    selMot.innerHTML = '<option value="">Motorista...</option>';
    appState.pessoas.filter(p=>p.ativo).forEach(p => selMot.add(new Option(p.nome, p.id)));
    
    const divPass = document.getElementById('listaPassageiros'); divPass.innerHTML = '';
    appState.pessoas.filter(p=>p.ativo).forEach(p => {
        divPass.innerHTML += `<label style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee;"><input type="checkbox" class="chk-pass" value="${p.id}" style="margin-right:10px; transform:scale(1.2);"> ${p.nome}</label>`;
    });

    if(id) {
        const v = appState.viagens.find(x => x.id == id);
        if(v) { 
            document.getElementById('viagemData').value = v.data; 
            selMot.value = v.motorista_id; 
            v.passageiros.forEach(p => { const chk = divPass.querySelector(`input[value="${p.pessoa_id}"]`); if(chk) chk.checked = true; }); 
            // Dispara o evento para travar o motorista na edição
            selMot.dispatchEvent(new Event('change'));
        }
    } else { 
        // AQUI ESTÁ A CORREÇÃO DA DATA:
        document.getElementById('viagemData').value = dataHojeBrasil(); 
    }
    document.getElementById('modalViagem').classList.remove('hidden');
};

async function salvarViagem() {
    const id = document.getElementById('viagemId').value;
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const valorUnit = parseFloat(appState.config.valor_padrao);
    const checks = document.querySelectorAll('.chk-pass:checked');
    
    if(!data || !motorista_id || checks.length === 0) return alert('Preencha tudo!');
    
    // Verificação de Data Duplicada
    if(!id && appState.viagens.some(v => v.data === data)) return alert('Já existe uma viagem neste dia!');
    
    try {
        mostrarLoading(true);
        const pass = Array.from(checks).map(c => ({ pessoa_id: c.value, valor: valorUnit, pago: false }));
        if(id) await window.viagensDB.atualizar(id, { data, motorista_id, valor_total: valorUnit * checks.length }, pass);
        else await window.viagensDB.criar({ data, motorista_id, valor_total: valorUnit * checks.length }, pass);
        
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        await carregarDados();
    } catch(e) { alert("Erro ao salvar."); }
    finally { mostrarLoading(false); }
}

async function salvarPessoa() {
    const nome = document.getElementById('pessoaNome').value;
    if(!nome) return;
    await window.pessoasDB.criar({ nome, ativo: true });
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    await carregarDados();
}

async function salvarConfig() {
    const val = parseFloat(document.getElementById('configValorPadrao').value);
    if(!val) return;
    await window.configDB.atualizar({ valor_padrao: val });
    appState.config.valor_padrao = val;
    alert('Salvo!');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function popularSelect() {
    const sel = document.getElementById('mesSelecionado');
    const v = `${appState.filtroMes}-${appState.filtroAno}`;
    sel.innerHTML = '';
    let m = appState.config.mes_atual; let a = appState.config.ano_atual;
    // Lista apenas até Fev/2026
    while (a > 2026 || (a === 2026 && m >= 2)) {
        sel.add(new Option(`${String(m).padStart(2,'0')}/${a}${ (m === appState.config.mes_atual && a === appState.config.ano_atual) ? ' (Aberto)' : ''}`, `${m}-${a}`));
        m--; if (m < 1) { m = 12; a--; }
    }
    sel.value = v;
}

async function fecharMes() {
    if(!confirm("Fechar mês?")) return;
    let nM = appState.config.mes_atual + 1; let nA = appState.config.ano_atual;
    if(nM > 12) { nM = 1; nA++; }
    await window.configDB.atualizar({ mes_atual: nM, ano_atual: nA });
    location.reload();
}

window.toggleAtivo = async (id, status) => { await window.pessoasDB.atualizar(id, {ativo: !status}); await carregarDados(); document.getElementById('modalAdmin').classList.add('hidden'); };
window.excluirViagem = async (id) => { if(confirm('Excluir?')) { await window.viagensDB.excluir(id); await carregarDados(); }};
const fmtMoeda = (v) => parseFloat(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const mostrarLoading = (s) => { const el = document.getElementById('loadingOverlay'); if(el) el.classList.toggle('hidden', !s); };
