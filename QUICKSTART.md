# 🚀 Guia Rápido de Início

## ⚡ Configuração em 5 Minutos

### 1️⃣ Criar Projeto no Supabase (2 min)
```
1. Acesse: https://supabase.com
2. Crie conta (gratuita)
3. "New Project" → Dê um nome → Escolha região → Create
4. Aguarde 2 minutos
```

### 2️⃣ Configurar Banco de Dados (1 min)
```
1. No Supabase: SQL Editor → New Query
2. Abra: supabase/schema.sql
3. Copie TODO conteúdo
4. Cole no editor SQL
5. Run (Ctrl+Enter)
```

### 3️⃣ Pegar Credenciais (30 seg)
```
1. Settings → API
2. Copie:
   - Project URL
   - anon public key
```

### 4️⃣ Configurar App (1 min)
```
1. Abra: js/supabase.js
2. Cole suas credenciais:
   
   const SUPABASE_URL = 'sua-url-aqui';
   const SUPABASE_ANON_KEY = 'sua-chave-aqui';
   
3. Salve!
```

### 5️⃣ Abrir no Navegador (30 seg)

**Opção A - Mais Fácil:**
```
1. VS Code → Instale extensão "Live Server"
2. Botão direito em index.html → Open with Live Server
```

**Opção B - Terminal:**
```bash
python -m http.server 8000
# Acesse: http://localhost:8000
```

## ✅ Pronto!

Você já pode:
- ✅ Cadastrar pessoas
- ✅ Registrar viagens
- ✅ Ver quem deve e quem recebe
- ✅ Fechar o mês
- ✅ Gerar relatórios

## 🌐 Colocar Online (Opcional)

### GitHub Pages (Grátis)
```bash
1. Crie repositório no GitHub
2. Upload dos arquivos
3. Settings → Pages → Source: main → Save
4. URL: https://seu-usuario.github.io/carona-app
```

### Vercel (Grátis)
```bash
npm i -g vercel
cd carona-app
vercel
# Siga instruções
```

### Netlify (Grátis)
```
1. Arraste pasta em: https://app.netlify.com/drop
2. Pronto!
```

## 📱 Usar no Celular

1. Abra o site no celular
2. Menu do navegador → "Adicionar à tela inicial"
3. Agora parece um app! 📱

## 🆘 Problemas?

**Erro ao conectar:**
- ✅ Conferiu URL e chave?
- ✅ Executou o SQL?
- ✅ Internet funcionando?

**Nada aparece:**
- ✅ Abra Console (F12)
- ✅ Veja mensagens de erro
- ✅ Cadastre primeira pessoa

**Precisa de ajuda?**
- Leia o README.md completo
- Documentação: https://supabase.com/docs

---

**🎉 Boa sorte com suas caronas!**
