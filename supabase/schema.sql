-- ============================================
-- SISTEMA DE CONTROLE DE CARONAS COMPARTILHADAS
-- ============================================

-- Tabela de Pessoas (podem ser motoristas OU passageiros)
CREATE TABLE pessoas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Viagens/Corridas
CREATE TABLE viagens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data DATE NOT NULL,
    motorista_id UUID REFERENCES pessoas(id) ON DELETE CASCADE,
    valor_total DECIMAL(10,2) NOT NULL,
    observacao TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Passageiros por Viagem
CREATE TABLE viagens_passageiros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    viagem_id UUID REFERENCES viagens(id) ON DELETE CASCADE,
    passageiro_id UUID REFERENCES pessoas(id) ON DELETE CASCADE,
    valor_individual DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(viagem_id, passageiro_id)
);

-- Tabela de Fechamentos Mensais
CREATE TABLE fechamentos_mensais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    data_fechamento TIMESTAMP DEFAULT NOW(),
    observacao TEXT,
    UNIQUE(mes, ano)
);

-- Tabela de Saldos por Fechamento
CREATE TABLE fechamentos_saldos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fechamento_id UUID REFERENCES fechamentos_mensais(id) ON DELETE CASCADE,
    pessoa_id UUID REFERENCES pessoas(id) ON DELETE CASCADE,
    saldo DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(fechamento_id, pessoa_id)
);

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Saldo atual de cada pessoa (mês corrente)
CREATE OR REPLACE VIEW vw_saldos_atuais AS
WITH saldo_como_motorista AS (
    SELECT 
        v.motorista_id as pessoa_id,
        COALESCE(SUM(v.valor_total), 0) as total_recebido
    FROM viagens v
    WHERE DATE_TRUNC('month', v.data) = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY v.motorista_id
),
saldo_como_passageiro AS (
    SELECT 
        vp.passageiro_id as pessoa_id,
        COALESCE(SUM(vp.valor_individual), 0) as total_pago
    FROM viagens_passageiros vp
    INNER JOIN viagens v ON v.id = vp.viagem_id
    WHERE DATE_TRUNC('month', v.data) = DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY vp.passageiro_id
)
SELECT 
    p.id,
    p.nome,
    COALESCE(sm.total_recebido, 0) as recebido,
    COALESCE(sp.total_pago, 0) as pago,
    COALESCE(sm.total_recebido, 0) - COALESCE(sp.total_pago, 0) as saldo
FROM pessoas p
LEFT JOIN saldo_como_motorista sm ON sm.pessoa_id = p.id
LEFT JOIN saldo_como_passageiro sp ON sp.pessoa_id = p.id
WHERE p.ativo = true
ORDER BY saldo DESC;

-- View: Histórico de viagens com detalhes
CREATE OR REPLACE VIEW vw_viagens_completas AS
SELECT 
    v.id,
    v.data,
    v.valor_total,
    v.observacao,
    p_motorista.nome as motorista,
    v.motorista_id,
    COUNT(vp.id) as num_passageiros,
    STRING_AGG(p_passageiro.nome, ', ' ORDER BY p_passageiro.nome) as passageiros
FROM viagens v
INNER JOIN pessoas p_motorista ON p_motorista.id = v.motorista_id
LEFT JOIN viagens_passageiros vp ON vp.viagem_id = v.id
LEFT JOIN pessoas p_passageiro ON p_passageiro.id = vp.passageiro_id
GROUP BY v.id, v.data, v.valor_total, v.observacao, p_motorista.nome, v.motorista_id
ORDER BY v.data DESC, v.created_at DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Calcular saldo de uma pessoa em um período
CREATE OR REPLACE FUNCTION calcular_saldo_pessoa(
    p_pessoa_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_recebido DECIMAL(10,2);
    v_pago DECIMAL(10,2);
BEGIN
    -- Calcular quanto recebeu como motorista
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_recebido
    FROM viagens
    WHERE motorista_id = p_pessoa_id
    AND data BETWEEN p_data_inicio AND p_data_fim;
    
    -- Calcular quanto pagou como passageiro
    SELECT COALESCE(SUM(vp.valor_individual), 0)
    INTO v_pago
    FROM viagens_passageiros vp
    INNER JOIN viagens v ON v.id = vp.viagem_id
    WHERE vp.passageiro_id = p_pessoa_id
    AND v.data BETWEEN p_data_inicio AND p_data_fim;
    
    RETURN v_recebido - v_pago;
END;
$$ LANGUAGE plpgsql;

-- Function: Realizar fechamento mensal
CREATE OR REPLACE FUNCTION realizar_fechamento_mensal(
    p_mes INTEGER,
    p_ano INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_fechamento_id UUID;
    v_pessoa RECORD;
    v_data_inicio DATE;
    v_data_fim DATE;
BEGIN
    -- Calcular primeiro e último dia do mês
    v_data_inicio := make_date(p_ano, p_mes, 1);
    v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    -- Criar fechamento
    INSERT INTO fechamentos_mensais (mes, ano)
    VALUES (p_mes, p_ano)
    RETURNING id INTO v_fechamento_id;
    
    -- Calcular e salvar saldo de cada pessoa
    FOR v_pessoa IN SELECT id FROM pessoas WHERE ativo = true
    LOOP
        INSERT INTO fechamentos_saldos (fechamento_id, pessoa_id, saldo)
        VALUES (
            v_fechamento_id,
            v_pessoa.id,
            calcular_saldo_pessoa(v_pessoa.id, v_data_inicio, v_data_fim)
        );
    END LOOP;
    
    RETURN v_fechamento_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_viagens_data ON viagens(data);
CREATE INDEX idx_viagens_motorista ON viagens(motorista_id);
CREATE INDEX idx_viagens_passageiros_viagem ON viagens_passageiros(viagem_id);
CREATE INDEX idx_viagens_passageiros_passageiro ON viagens_passageiros(passageiro_id);
CREATE INDEX idx_fechamentos_mes_ano ON fechamentos_mensais(ano, mes);

-- ============================================
-- DADOS INICIAIS (EXEMPLO)
-- ============================================

-- Inserir pessoas de exemplo (REMOVA OU ADAPTE CONFORME NECESSÁRIO)
INSERT INTO pessoas (nome) VALUES 
    ('João Silva'),
    ('Maria Santos'),
    ('Pedro Oliveira'),
    ('Ana Costa');

-- ============================================
-- POLÍTICAS RLS (Row Level Security) - OPCIONAL
-- ============================================
-- Descomente se quiser adicionar controle de acesso por usuário

-- ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE viagens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE viagens_passageiros ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fechamentos_saldos ENABLE ROW LEVEL SECURITY;

-- Política: Permitir tudo para usuários autenticados
-- CREATE POLICY "Permitir todas operações para autenticados" ON pessoas
--     FOR ALL USING (auth.role() = 'authenticated');
