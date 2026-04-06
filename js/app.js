const appState = {
    config: { mes_atual: 2, ano_atual: 2026, valor_padrao: 8 },
    filtroMes: 2, filtroAno: 2026,
    pessoas: [], viagens: [], saldos: [],
    isAdmin: localStorage.getItem('modoAdmin') === 'true'
};

// 🛡️ FUNÇÃO DE SEGURANÇA: Garante que um valor é sempre número (evita o R$ NaN)
const parseNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};

// 🛡️ FUNÇÃO DE SEGURANÇA: Garante formatação correta do dinheiro
const fmtMoeda = (v) => parseNum(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const conf = await window.configDB.obter();
        
        // Mesclagem super segura das configurações
        if (conf && typeof conf === 'object') {
            const dadosConf = Array.isArray(conf) ? conf[0] : conf;
            if (dadosConf) {
                appState.config = { ...appState.config, ...dadosConf };
            }
        }
        
        // Garante que nunca teremos meses "undefined" ou "NaN"
        appState.config.mes_atual = parseNum(appState.config.mes_atual) || (new Date().getMonth() + 1);
        appState.config.ano_atual = parseNum(appState.config.ano_atual) || new Date().getFullYear();
        appState.config.valor_padrao = parseNum(appState.config.valor_padrao) || 8;
        
        appState.filtroMes = appState.config.mes_atual;
        appState.filtroAno = appState.config.ano_atual;
        
        configurarInterface();
        await carregarDados();
    } catch(e) { console.error("Erro ao iniciar:", e); }
});

function dataHojeBrasil() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const mostrarLoading = (s) => { 
    const el = document.getElementById('loadingOverlay'); 
    if(el) el.classList.toggle('hidden', !s); 
};

async function carregarDados() {
    mostrarLoading(true);
    try {
        const { data: p } = await window.pessoasDB.listar();
        const { data: v } = await window.viagensDB.listar(appState.filtroMes, appState.filtroAno);
        const { data: s } = await window.saldosDB.listarAtuais();
        
        appState.pessoas = p || [];
        appState.viagens = v || [];
        
        const listaSaldos = s || [];
        appState.saldos = listaSaldos.map(pessoa => {
            let pag = 0; let rec = 0;
            appState.viagens.forEach(via => {
                const passageirosSeguros = via.passageiros || [];
                if (via.motorista_id === pessoa.id) {
                    rec += passageirosSeguros.reduce((acc, pass) => acc + parseNum(pass.valor), 0);
                }
                const souPass = passageirosSeguros.find(pass => pass.pessoa_id === pessoa.id);
                if (souPass) pag += parseNum(souPass.valor);
            });
            return { ...pessoa, a_pagar: pag, a_receber: rec, saldo_liq: rec - pag };
        });
        renderizar();
    } catch(e) { console.error("Erro ao carregar dados:", e); }
    finally { mostrarLoading(false); }
}

function renderizar() {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    
    // Tratativa segura do rótulo do mês
    const indexMes = parseNum(appState.filtroMes) - 1;
    const nomeMes = meses[indexMes] || String(appState.filtroMes).padStart(2, '0');
    
    const labelMes = document.getElementById('labelMes');
    if(labelMes) labelMes.innerText = `${nomeMes}/${appState.filtroAno}`;
    
    const totalV = document.getElementById('totalViagens');
    if(totalV) totalV.innerText = appState.viagens.length;

    const tbS = document.querySelector('#tabelaPessoas tbody'); 
    if(tbS) {
        tbS.innerHTML = '';
        appState.saldos.filter(x => x.ativo || appState.isAdmin).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${s.nome}</td>
                            <td class="text-right text-danger">${fmtMoeda(s.a_pagar)}</td>
                            <td class="text-right text-success">${fmtMoeda(s.a_receber)}</td>
                            <td class="text-right font-bold ${s.saldo_liq >= 0 ? 'text-success' : 'text-danger'}">${fmtMoeda(s.saldo_liq)}</td>`;
            tbS.appendChild(tr);
        });
    }

    const tbV = document.querySelector('#tabelaViagens tbody'); 
    if(tbV) {
        tbV.innerHTML = '';
        appState.viagens.forEach(v => {
            const tr = document.createElement('tr');
            const podeEditar = (appState.filtroMes === appState.config.mes_atual && appState.filtroAno === appState.config.ano_atual);
            
            // Tratamento de Data ultra seguro
            let dataFormatada = v.data ? String(v.data) : '';
            if (dataFormatada.includes('-')) {
                const pd = dataFormatada.split('T')[0].split('-'); // Tira horário se vier ISO
                dataFormatada = pd.length === 3 ? `${pd[2]}/${pd[1]}/${pd[0]}` : dataFormatada;
            } else {
                dataFormatada = '-';
            }

            const passageirosArray = v.passageiros || [];
            const nomesPassageiros = passageirosArray.map(p => {
                const pessoa = appState.pessoas.find(pes => pes.id === p.pessoa_id);
                return pessoa ? pessoa.nome : '?';
            }).join(', ') || '-';

            // Tratamento seguro do valor total
            const valorViagem = parseNum(v.valor_total) || passageirosArray.reduce((acc, p) => acc + parseNum(p.valor), 0);

            tr.innerHTML = `
                <td>${dataFormatada}</td>
                <td><strong>${v.motorista?.nome || '?'}</strong></td>
                <td style="font-size: 0.85rem; color: #666; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nomesPassageiros}</td>
                <td class="text-right">${fmtMoeda(valorViagem)}</td>
                <td class="admin-only" style="text-align:center;">
                    ${podeEditar ? `<button class="btn btn-secondary btn-sm" onclick="window.abrirModalViagem(${v.id})">✏️</button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="excluirViagem(${v.id})">🗑️</button>
                </td>`;
            tbV.appendChild(tr);
        });
    }
    
    popularSelect();
    gerarRelatorioMensal(); 
    
    document.body.classList.toggle('modo-admin-ativo', appState.isAdmin);
}

function configurarInterface() {
    document.getElementById('btnNovaViagem').onclick = () => window.abrirModalViagem();
    
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
        if(!e.target.value) return;
        const partes = e.target.value.split('-');
        if(partes.length === 2) {
            appState.filtroMes = parseNum(partes[0]); 
            appState.filtroAno = parseNum(partes[1]);
            carregarDados();
        }
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
            document.getElementById('viagemData').value = v.data || dataHojeBrasil(); 
            selMot.value = v.motorista_id; 
            const passArray = v.passageiros || [];
            passArray.forEach(p => { const chk = divPass.querySelector(`input[value="${p.pessoa_id}"]`); if(chk) chk.checked = true; }); 
            selMot.dispatchEvent(new Event('change'));
        }
    } else { 
        document.getElementById('viagemData').value = dataHojeBrasil(); 
    }
    document.getElementById('modalViagem').classList.remove('hidden');
};

async function salvarViagem() {
    const id = document.getElementById('viagemId').value;
    const data = document.getElementById('viagemData').value;
    const motorista_id = document.getElementById('viagemMotorista').value;
    const valorUnit = parseNum(appState.config.valor_padrao);
    const checks = document.querySelectorAll('.chk-pass:checked');
    
    if(!data || !motorista_id || checks.length === 0) return alert('Preencha tudo!');
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
    const val = parseNum(document.getElementById('configValorPadrao').value);
    if(!val) return;
    await window.configDB.atualizar({ valor_padrao: val });
    appState.config.valor_padrao = val;
    alert('Salvo!');
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function popularSelect() {
    const sel = document.getElementById('mesSelecionado');
    if(!sel) return;
    
    sel.innerHTML = '';
    let m = parseNum(appState.config.mes_atual); 
    let a = parseNum(appState.config.ano_atual);
    
    // Lista histórica segura de alguns meses
    for(let i = 0; i < 12; i++) {
        const value = `${m}-${a}`;
        const texto = `${String(m).padStart(2,'0')}/${a}${ (m === appState.config.mes_atual && a === appState.config.ano_atual) ? ' (Aberto)' : ''}`;
        sel.add(new Option(texto, value));
        m--; if (m < 1) { m = 12; a--; }
        if(a < 2026) break; // Trava de segurança do ano base
    }
    
    const v = `${appState.filtroMes}-${appState.filtroAno}`;
    // Se o valor não existir no select (foi apagado), adicionamos para não quebrar
    if (!Array.from(sel.options).some(opt => opt.value === v)) {
         sel.add(new Option(`${String(appState.filtroMes).padStart(2,'0')}/${appState.filtroAno}`, v));
    }
    sel.value = v;
}

async function fecharMes() {
    if(!confirm("Fechar mês?")) return;
    let nM = appState.config.mes_atual + 1; 
    let nA = appState.config.ano_atual;
    if(nM > 12) { nM = 1; nA++; }
    await window.configDB.atualizar({ mes_atual: nM, ano_atual: nA });
    location.reload();
}

function gerarRelatorioMensal() {
    const viagens = appState.viagens || [];
    
    const totalValor = viagens.reduce((acc, v) => {
        const passArray = v.passageiros || [];
        const val = parseNum(v.valor_total) || passArray.reduce((s, p) => s + parseNum(p.valor), 0);
        return acc + val;
    }, 0);
    
    const totalDias = viagens.length;
    
    const elValor = document.getElementById('relTotalValor');
    const elDias = document.getElementById('relTotalDias');
    if(elValor) elValor.innerText = fmtMoeda(totalValor);
    if(elDias) elDias.innerText = totalDias;

    const tbody = document.getElementById('corpoRelatorioMensal');
    if(!tbody) return;

    if (viagens.length === 0) {
        document.getElementById('relTopMotorista').innerText = '-';
        document.getElementById('relTopPassageiro').innerText = '-';
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 15px; color: #666;">Nenhuma viagem neste mês.</td></tr>';
        return;
    }

    const stats = {};
    appState.pessoas.forEach(p => {
        stats[p.id] = { nome: p.nome, dirigiu: 0, caronas: 0 };
    });

    viagens.forEach(v => {
        if(stats[v.motorista_id]) stats[v.motorista_id].dirigiu++;
        const passArray = v.passageiros || [];
        passArray.forEach(p => {
            if(stats[p.pessoa_id]) stats[p.pessoa_id].caronas++;
        });
    });

    let topMot = { nome: '-', max: 0 };
    let topPass = { nome: '-', max: 0 };
    
    tbody.innerHTML = '';

    Object.values(stats).forEach(s => {
        if (s.dirigiu > topMot.max) topMot = { nome: s.nome, max: s.dirigiu };
        if (s.caronas > topPass.max) topPass = { nome: s.nome, max: s.caronas };
        
        if (s.dirigiu > 0 || s.caronas > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.nome}</strong></td>
                <td class="text-center">${s.dirigiu}x</td>
                <td class="text-center">${s.caronas}x</td>
            `;
            tbody.appendChild(tr);
        }
    });

    document.getElementById('relTopMotorista').innerText = topMot.max > 0 ? topMot.nome : '-';
    document.getElementById('relTopPassageiro').innerText = topPass.max > 0 ? topPass.nome : '-';
}

window.toggleAtivo = async (id, status) => { await window.pessoasDB.atualizar(id, {ativo: !status}); await carregarDados(); document.getElementById('modalAdmin').classList.add('hidden'); };
window.excluirViagem = async (id) => { if(confirm('Excluir?')) { await window.viagensDB.excluir(id); await carregarDados(); }};
