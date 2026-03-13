# Git Worktrees + Claude Code: Guia Prático para Desenvolvimento Paralelo

## O Problema

Quando você está usando o Claude Code em um projeto e precisa trabalhar em outra tarefa simultaneamente, tem um dilema: seu repositório Git só tem **um working directory**. Se o Claude está no meio de uma feature, os arquivos estão em estado parcialmente modificado — você não pode simplesmente trocar de branch sem perder contexto ou causar conflitos.

A alternativa ingênua seria clonar o repo de novo, mas isso duplica todo o histórico, consome disco, e exige reinstalar dependências. Não escala.

## O que são Git Worktrees?

Um **worktree** é um diretório de trabalho adicional vinculado ao mesmo repositório. Cada worktree tem seu próprio checkout de uma branch e seus próprios arquivos em disco, mas **compartilham o mesmo histórico Git**, objetos e configuração.

```
Sem worktrees (sequencial):
┌──────────────────────────────────────┐
│ /meu-projeto (main)                  │
│                                      │
│  Claude Code sessão 1 → feature-auth │
│  ❌ Precisa pausar pra fazer hotfix  │
│  git stash → git checkout → perdeu   │
│  contexto do Claude                  │
└──────────────────────────────────────┘

Com worktrees (paralelo):
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ /meu-projeto        │  │ .claude/worktrees/   │  │ .claude/worktrees/  │
│ branch: main        │  │ feature-auth/        │  │ hotfix-123/         │
│ Claude Code ✅      │  │ Claude Code ✅       │  │ Claude Code ✅      │
│ Contexto preservado │  │ Contexto preservado  │  │ Contexto preservado │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
        ↑ Todos compartilham o mesmo histórico Git ↑
```

## Método 1: Flag nativa do Claude Code (Recomendado)

O Claude Code tem suporte nativo via a flag `--worktree` (ou `-w`). Ele cria o worktree, faz checkout da branch, e inicia a sessão automaticamente.

### Uso básico

```bash
# Terminal 1 — trabalhando na feature de autenticação
claude --worktree feature-auth

# Terminal 2 — corrigindo um bug em paralelo
claude --worktree bugfix-123

# Terminal 3 — explorando um refactor
claude --worktree refactor-api
```

Cada comando cria um diretório isolado em `.claude/worktrees/<nome>/` com uma branch `worktree-<nome>`.

### Sem nome (Claude gera automaticamente)

```bash
claude --worktree
# Claude cria um nome aleatório pra você
```

### Combinando com tmux

```bash
# Lança o Claude em uma sessão tmux separada
claude --worktree feature-auth --tmux
```

## Método 2: Git Worktree Manual

Se quiser mais controle sobre onde os worktrees ficam e qual branch usam:

### Criando worktrees

```bash
# Navega até o projeto
cd /home/user/meu-projeto

# Cria um worktree com uma nova branch baseada em main
git worktree add ../meu-projeto-feature-auth -b feature-auth

# Cria outro worktree para hotfix
git worktree add ../meu-projeto-hotfix -b hotfix-123

# Agora você tem:
# /home/user/meu-projeto               → branch main
# /home/user/meu-projeto-feature-auth  → branch feature-auth
# /home/user/meu-projeto-hotfix        → branch hotfix-123
```

### Rodando Claude Code em cada worktree

```bash
# Terminal 1
cd /home/user/meu-projeto
claude
# Peça: "Implemente o sistema de cache do Redis"

# Terminal 2
cd /home/user/meu-projeto-feature-auth
claude
# Peça: "Crie o módulo de autenticação OAuth2"

# Terminal 3
cd /home/user/meu-projeto-hotfix
claude
# Peça: "Corrija o bug de timeout na API de pagamentos"
```

### Listando worktrees ativos

```bash
git worktree list
# /home/user/meu-projeto               abc1234 [main]
# /home/user/meu-projeto-feature-auth  def5678 [feature-auth]
# /home/user/meu-projeto-hotfix        ghi9012 [hotfix-123]
```

### Removendo worktrees

```bash
# Quando terminar o trabalho e já tiver feito merge
git worktree remove ../meu-projeto-feature-auth

# Limpar metadados de worktrees deletados manualmente
git worktree prune
```

## Fluxo de Trabalho Completo (Exemplo Real)

### Cenário: Você tem 3 tarefas no IBVI para fazer hoje

```bash
# 1. Crie os worktrees
cd ~/projects/ibvi-platform

claude -w lead-enrichment
# → Pede: "Implemente o endpoint de enriquecimento de leads
#    usando a base de 223M registros do IPTU. Use Meilisearch
#    para busca e retorne dados consolidados do imóvel + proprietário."

# Abre outro terminal (Cmd+T ou Ctrl+Shift+T)
claude -w meilisearch-optimization
# → Pede: "Otimize os índices do Meilisearch para busca por
#    endereço. Implemente normalização de logradouros e
#    filterable attributes por bairro e zona."

# Abre mais um terminal
claude -w api-tests
# → Pede: "Escreva testes de integração para todos os endpoints
#    da API de propriedades. Use o holdout test suite pattern."
```

### 2. Monitore o progresso

Alterne entre os terminais para:
- Aprovar permissões quando o Claude pedir
- Verificar se está no caminho certo
- Dar feedback e redirecionamentos

### 3. Finalize e faça merge

```bash
# Quando cada Claude terminar, ele faz commit na branch dele
# Volte ao worktree principal
cd ~/projects/ibvi-platform

# Faça merge de cada feature
git merge worktree-lead-enrichment
git merge worktree-meilisearch-optimization
git merge worktree-api-tests

# Se houver conflitos, resolva normalmente
```

## Cleanup Automático do Claude Code

Quando você encerra uma sessão de worktree do Claude Code:

- **Sem alterações**: o worktree e a branch são removidos automaticamente
- **Com commits/alterações**: o Claude pergunta se você quer manter ou remover

Para evitar que os worktrees apareçam como untracked files:

```bash
# Adicione ao .gitignore
echo ".claude/worktrees/" >> .gitignore
```

## Subagents com Worktrees

Você pode pedir ao Claude Code para usar worktrees nos seus subagentes internos:

```
> Use worktrees para seus agentes e implemente estas 3 features em paralelo:
  1. Sistema de cache Redis
  2. Middleware de rate limiting  
  3. Logger estruturado com correlation IDs
```

Cada subagente recebe seu próprio worktree isolado, trabalha independentemente, e o cleanup é automático.

## Regras Importantes

1. **Não pode ter a mesma branch em dois worktrees** — cada worktree precisa de sua própria branch
2. **Worktrees compartilham o histórico** — fetches e pushes afetam todos
3. **Conflitos de merge são normais** — se dois worktrees editam o mesmo arquivo, você resolve no merge (igual qualquer branch)
4. **Dependências podem precisar ser reinstaladas** — se o projeto usa `node_modules` ou `venv`, cada worktree pode precisar rodar `npm install` ou `pip install`
5. **Tokens são consumidos por sessão** — múltiplas sessões paralelas consomem mais da sua cota

## Dicas de Produtividade

- **Use tmux ou terminal tabs** para gerenciar as sessões visualmente
- **Rode `/init` em cada worktree** para o Claude Code gerar um CLAUDE.md específico
- **Foque tarefas independentes** em paralelo — evite duas sessões editando os mesmos arquivos
- **Configure notificações** (`/hooks` → Notification) para saber quando o Claude terminar ou precisar de input
- **Commite frequentemente** dentro de cada worktree para não perder trabalho

## Referência Rápida

| Comando | O que faz |
|---------|-----------|
| `claude -w nome` | Cria worktree + inicia sessão |
| `claude --worktree` | Cria worktree com nome aleatório |
| `claude -w nome --tmux` | Cria worktree em sessão tmux |
| `git worktree list` | Lista todos os worktrees |
| `git worktree add path -b branch` | Cria worktree manual |
| `git worktree remove path` | Remove worktree |
| `git worktree prune` | Limpa metadados órfãos |
