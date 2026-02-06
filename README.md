# 🚗 Sistema de Controle de Caronas Compartilhadas

Sistema web moderno para controle de caronas compartilhadas com cálculo automático de débitos e créditos, desenvolvido com HTML, CSS, JavaScript e Supabase.

## 📋 Funcionalidades

### ✅ Principais Recursos

- **Gestão de Pessoas**: Cadastro único de pessoas que podem ser motoristas OU passageiros
- **Registro de Viagens**: Registro diário com motorista, passageiros e divisão automática de valores
- **Cálculo Automático**: Cálculo em tempo real de quem deve e quem recebe
- **Dashboard Interativo**: Visão geral mensal com estatísticas e saldos
- **Fechamento Mensal**: Fechamento de mês com registro histórico de saldos
- **Relatórios**: Relatórios detalhados por período selecionado
- **Interface Responsiva**: Funciona perfeitamente em celular, tablet e desktop

### 🎯 Características Técnicas

- ✅ **100% Web**: Acesse de qualquer dispositivo
- ✅ **Banco de Dados na Nuvem**: Backup automático com Supabase
- ✅ **Interface Moderna**: Design limpo e profissional
- ✅ **Sem Instalação**: Basta abrir no navegador
- ✅ **Multi-usuário**: Várias pessoas podem acessar simultaneamente

## 🚀 Instalação e Configuração

### Passo 1: Criar Conta no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Clique em **"Start your project"** e crie uma conta (gratuita)
3. Após login, clique em **"New Project"**
4. Preencha os dados:
   - **Name**: `carona-app` (ou nome de sua preferência)
   - **Database Password**: Crie uma senha forte (anote!)
   - **Region**: Escolha a mais próxima (ex: South America)
5. Clique em **"Create new project"** e aguarde ~2 minutos

### Passo 2: Configurar o Banco de Dados

1. No painel do Supabase, vá em **SQL Editor** (menu lateral)
2. Clique em **"New Query"**
3. Abra o arquivo `supabase/schema.sql` deste projeto
4. **COPIE TODO O CONTEÚDO** do arquivo
5. **COLE** no editor SQL do Supabase
6. Clique em **"Run"** (ou pressione `Ctrl+Enter`)
7. Aguarde a mensagem de sucesso ✅

### Passo 3: Obter Credenciais

1. No Supabase, vá em **Settings** > **API** (menu lateral)
2. Você verá duas informações importantes:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Uma chave longa começando com `eyJ...`
3. **COPIE** essas duas informações

### Passo 4: Configurar a Aplicação

1. Abra o arquivo `js/supabase.js`
2. Localize as linhas:
```javascript
const SUPABASE_URL = 'SEU_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY_AQUI';
```
3. **SUBSTITUA** pelas suas credenciais:
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...sua-chave-aqui...';
```
4. **SALVE** o arquivo

### Passo 5: Executar a Aplicação

#### Opção A: Localmente (Mais simples)

1. Instale a extensão **Live Server** no VS Code
2. Clique com botão direito no arquivo `index.html`
3. Selecione **"Open with Live Server"**
4. O navegador abrirá automaticamente!

#### Opção B: Servidor Python

```bash
# No terminal, dentro da pasta do projeto:
python -m http.server 8000

# Acesse: http://localhost:8000
```

#### Opção C: Deploy na Nuvem (Grátis)

**Usando Vercel:**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
cd carona-app
vercel
```

**Usando Netlify:**
1. Arraste a pasta do projeto para [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Pronto! Você terá uma URL pública

**Usando GitHub Pages:**
1. Crie um repositório no GitHub
2. Faça upload dos arquivos
3. Vá em Settings > Pages
4. Selecione a branch main e salve
5. Seu site estará em `https://seu-usuario.github.io/carona-app`

## 📱 Como Usar

### 1. Cadastrar Pessoas

1. Vá na aba **"Pessoas"**
2. Clique em **"+ Nova Pessoa"**
3. Digite o nome e clique em **"Salvar"**
4. Repita para todas as pessoas do grupo

### 2. Registrar uma Viagem

1. Vá na aba **"Viagens"**
2. Clique em **"+ Nova Viagem"**
3. Preencha:
   - **Data**: Data da viagem
   - **Motorista**: Quem dirigiu
   - **Valor Total**: Valor total da corrida
   - **Passageiros**: Selecione quem estava no carro
4. O sistema **divide automaticamente** o valor entre os passageiros
5. Clique em **"Salvar"**

### 3. Visualizar Saldos

- No **Dashboard**, veja quem está devendo ou recebendo
- Saldos são atualizados automaticamente a cada viagem
- **Verde** = Pessoa tem a receber
- **Vermelho** = Pessoa tem a pagar

### 4. Fechar o Mês

1. No final do mês, clique em **"Fechar Mês"**
2. O sistema registra os saldos finais
3. No próximo mês, tudo zera e começa de novo
4. O histórico fica salvo nos Relatórios

### 5. Gerar Relatórios

1. Vá na aba **"Relatórios"**
2. Selecione o mês desejado
3. Clique em **"Gerar Relatório"**
4. Veja viagens, totais e saldos do período

## 🎨 Personalização

### Alterar Cores

Edite o arquivo `css/style.css`, seção `:root`:

```css
:root {
    --primary: #2563eb;      /* Cor principal */
    --success: #10b981;      /* Verde (receber) */
    --danger: #ef4444;       /* Vermelho (pagar) */
}
```

### Adicionar Campos Extras

Edite `supabase/schema.sql` e adicione colunas nas tabelas:

```sql
-- Exemplo: Adicionar campo "telefone" na tabela pessoas
ALTER TABLE pessoas ADD COLUMN telefone VARCHAR(20);
```

Depois atualize o HTML e JavaScript conforme necessário.

## 📊 Estrutura do Projeto

```
carona-app/
├── index.html              # Página principal
├── css/
│   └── style.css          # Estilos da aplicação
├── js/
│   ├── supabase.js        # Configuração e funções do banco
│   ├── utils.js           # Funções utilitárias
│   └── app.js             # Lógica principal
├── supabase/
│   └── schema.sql         # Estrutura do banco de dados
└── README.md              # Este arquivo
```

## 🔒 Segurança

### Dados Públicos vs. Privados

Por padrão, **qualquer pessoa com acesso ao link pode ver e editar os dados**.

Para adicionar autenticação:

1. No Supabase, vá em **Authentication** > **Providers**
2. Ative **Email** ou **Google/GitHub**
3. Descomente as políticas RLS no arquivo `schema.sql`:

```sql
-- Descomentar estas linhas:
ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON pessoas FOR ALL USING (auth.role() = 'authenticated');
```

4. Adicione tela de login no HTML

## 🐛 Solução de Problemas

### "Erro ao conectar ao Supabase"

- ✅ Verifique se copiou corretamente a URL e a chave
- ✅ Certifique-se de que executou o SQL (`schema.sql`)
- ✅ Verifique se há aspas ou espaços extras no arquivo `supabase.js`

### "Nenhuma pessoa/viagem aparece"

- ✅ Abra o Console do navegador (F12) e veja se há erros
- ✅ Verifique se o banco foi criado corretamente
- ✅ Tente cadastrar uma pessoa manualmente

### "Erro ao salvar dados"

- ✅ Verifique sua conexão com a internet
- ✅ Confirme que o projeto Supabase está ativo
- ✅ Revise se preencheu todos os campos obrigatórios

### Limpar Dados de Teste

Se quiser começar do zero:

```sql
-- Execute no SQL Editor do Supabase
TRUNCATE TABLE viagens_passageiros CASCADE;
TRUNCATE TABLE viagens CASCADE;
TRUNCATE TABLE fechamentos_saldos CASCADE;
TRUNCATE TABLE fechamentos_mensais CASCADE;
TRUNCATE TABLE pessoas CASCADE;
```

## 📈 Melhorias Futuras (Opcionais)

- [ ] Notificações por email de saldo devedor
- [ ] Exportar relatórios em PDF
- [ ] Gráficos de gastos mensais
- [ ] Integração com WhatsApp
- [ ] App mobile nativo (React Native)
- [ ] Múltiplos grupos de caronas

## 🤝 Contribuindo

Sinta-se à vontade para:

- Reportar bugs
- Sugerir melhorias
- Fazer fork e customizar para suas necessidades
- Compartilhar com amigos!

## 📄 Licença

Este projeto é de código aberto. Use livremente!

## 💡 Dicas de Uso

1. **Combine um valor padrão**: Se vocês sempre cobram o mesmo valor, defina isso entre o grupo
2. **Acerte no final do mês**: Use o fechamento mensal para acertar as contas
3. **Backup**: O Supabase já faz backup automático, mas você pode exportar os dados periodicamente
4. **Mobile**: Adicione o site à tela inicial do celular para parecer um app nativo

## 📞 Suporte

- **Documentação Supabase**: [https://supabase.com/docs](https://supabase.com/docs)
- **Tutorial JavaScript**: [https://javascript.info](https://javascript.info)
- **Stack Overflow**: Para dúvidas técnicas

---

**Desenvolvido com ❤️ para facilitar o controle de caronas compartilhadas!**

Boa sorte e boas viagens! 🚗💨
