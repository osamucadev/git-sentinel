# Guia do Git Sentinel

O Git Sentinel é uma aplicação desktop Linux, local-first, para observar vários repositórios Git em um único lugar. Ele ajuda a decidir o que precisa de atenção sem substituir Git, IDE, terminal ou fluxo de trabalho habitual.

## Conteúdo

- [Primeiros passos](#primeiros-passos)
- [Como ler o estado de um repositório](#como-ler-o-estado-de-um-repositório)
- [Ações e atividade](#ações-e-atividade)
- [Personalidades e idiomas](#personalidades-e-idiomas)
- [Modelo de segurança](#modelo-de-segurança)
- [Plataformas e limitações](#plataformas-e-limitações)
- [Arquitetura](#arquitetura)
- [Contribuindo](#contribuindo)

## Primeiros passos

Na primeira execução, escolha uma personalidade visual, o idioma da interface e como o Sentinel deve chamá-lo. Adicione repositórios Git locais pela HQ. O Sentinel valida a pasta selecionada antes de registrá-la e guarda somente o caminho e suas próprias preferências.

A inspeção inicial é local. Enquanto um repositório ainda não retornou resultado, ele aparece como carregando; nunca é contado como saudável apenas porque a inspeção está pendente.

## Como ler o estado de um repositório

A HQ agrupa os repositórios por urgência. A apresentação pode mudar conforme a personalidade, mas os fatos são os mesmos.

### Branch atual

A branch atual aparece ao lado do nome do repositório quando HEAD está attached. Um HEAD detached é mostrado explicitamente. Conflitos têm prioridade visual sobre detached, porque resolvê-los é a necessidade imediata.

### Local

O sinal **Local** descreve a working tree. Ele pode mostrar uma árvore limpa, o total compacto de alterações locais ou a quantidade de conflitos. O texto secundário detalha arquivos em stage, modificados, removidos e não rastreados.

### Upstream

O sinal **Upstream** compara a branch atual com sua própria branch de tracking. Ele pode indicar sincronizada, à frente, atrás, divergida, indisponível ou sem upstream.

“Tracking indisponível” significa que o Sentinel não possui informação Git suficiente para fazer a comparação. Isso **não** significa que o upstream desapareceu.

### Referência

O sinal opcional **Referência** compara a branch atual com a branch de referência configurada para o projeto. Ele é separado do upstream de propósito. Uma feature pode estar sincronizada com seu upstream e ainda diferir de `origin/main`, `origin/homolog` ou de outra referência do projeto.

### Atualidade

Dados de tracking remoto são um retrato local. O Sentinel mostra quando as refs remotas foram buscadas pela última vez, pois números de à frente/atrás não comprovam o estado atual de um servidor. O Fetch automático é opcional, começa desativado e só funciona enquanto o app está aberto.

## Ações e atividade

### Atualizar

Atualizar re-inspeciona um repositório usando apenas informação Git local. Não utiliza rede. O Sentinel também observa metadados Git locais relevantes com debounce; assim, um commit externo ou uma alteração na working tree atualiza somente o repositório afetado.

### Fetch e Fetch em todos

Fetch atualiza as refs de tracking remoto de um repositório. Fetch em todos executa o mesmo trabalho pela fleet com limite pequeno de concorrência. Comandos de rede são executados fora do event loop gráfico; o aplicativo continua rolável e navegável durante a operação.

### Push e revisão somente leitura

Push é uma ação explícita de `git push` normal para uma branch com commits aguardando o upstream configurado. Git Sentinel nunca usa force. Repository Details também lista arquivos alterados e mostra diffs staged e unstaged sem escrever na working tree ou no index.

A faixa de atividade mostra progresso de inspeções e fetches, incluindo concluídos, falhas e um repositório ativo. Ações conflitantes podem ser desabilitadas temporariamente, mas a navegação continua disponível.

### Outras ações

- **Abrir no Terminal** abre o caminho do repositório em um emulador de terminal disponível.
- **Abrir pasta** abre o diretório no gerenciador de arquivos.
- **Remover do Sentinel** remove apenas o registro salvo pelo Sentinel. Nunca remove o repositório nem altera seu histórico Git.

## Personalidades e idiomas

Technical, Cute, Sci-Fi, Jarbas, Retro, Line Art, Pixel Art e Modern Glass são apresentações compartilhadas de uma única aplicação. Elas não possuem lógicas Git independentes. Trocar a personalidade altera tratamento visual e pequenas escolhas de tom, nunca os fatos Git.

Há suporte a inglês, português do Brasil e espanhol. Refs, caminhos, hashes e resultados de comandos Git permanecem factuais e não são traduzidos.

## Modelo de segurança

O Git Sentinel é um observador com uma ação explícita de publicação: Push normal. Não oferece pull, checkout, merge, rebase, reset, stash ou criação de branch. Também não instala hooks Git nos repositórios registrados.

Fetch é a única operação Git que usa rede. Ele atualiza referências de tracking, mas nunca integra mudanças remotas à branch de trabalho.

O Sentinel não administra GitHub, GitLab, SSH, HTTPS, OAuth, tokens ou credenciais. A autenticação continua sob responsabilidade da configuração Git já existente no sistema.

## Plataformas e limitações

O aplicativo é desenvolvido atualmente para Linux, em especial ambientes Debian e Ubuntu. Windows e macOS ainda não estão prontos nem são suportados.

Limites atuais:

- Fetch automático é opt-in e só funciona com o app aberto; sem serviço de polling remoto;
- sem notificações desktop, tray ou conta hospedada;
- sem sincronização na nuvem;
- a abertura de terminal depende de um emulador compatível instalado;
- o estado remoto é tão atual quanto o último fetch bem-sucedido.

## Arquitetura

```text
Repositório Git
  -> inspeção pelo core Rust
  -> RepositoryState normalizado
  -> comandos Tauri e watcher local
  -> estado React compartilhado
  -> apresentação da personalidade
```

O core Rust coleta fatos Git por argumentos explícitos e saídas legíveis por máquina. Ele produz um `RepositoryState` normalizado; o frontend deriva prioridade da fleet, copy humana, sinais, traduções e apresentação visual a partir desses fatos. Assim, comportamento Git e aparência permanecem separados.

## Contribuindo

Execute as verificações antes de propor uma mudança:

```bash
npm test
npm run test:core
npm run build
```

Portes de plataforma, documentação, acessibilidade, traduções, refinamentos de design e cobertura de testes são bem-vindos. O Git Sentinel usa a [Licença MIT](../LICENSE), então você também pode fazer um fork e adaptá-lo ao seu fluxo de trabalho.
