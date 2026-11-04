/* =====================================================================
   USB Intelligence — VERSÃO MANUAL · comportamento das páginas
   JavaScript puro, sem bibliotecas. Cada bloco tem um comentário dizendo
   o que faz. Se apagar um bloco, só aquela função para de funcionar.
   ===================================================================== */

/* ---------- 1. Tema claro / escuro (lembra a escolha) ---------- */
(function tema() {
  var salvo = null;
  try { salvo = localStorage.getItem('manual-tema'); } catch (e) { /* sem armazenamento */ }
  if (salvo === 'claro') document.documentElement.classList.add('claro');
  var botao = document.getElementById('botao-tema');
  if (!botao) return;
  botao.addEventListener('click', function () {
    var claro = document.documentElement.classList.toggle('claro');
    botao.setAttribute('aria-label', claro ? 'Mudar para tema escuro' : 'Mudar para tema claro');
    try { localStorage.setItem('manual-tema', claro ? 'claro' : 'escuro'); } catch (e) { /* */ }
  });
})();

/* ---------- 2. Menu no celular ---------- */
(function menu() {
  var botao = document.getElementById('abre-menu');
  var lista = document.getElementById('menu');
  if (!botao || !lista) return;
  botao.addEventListener('click', function () {
    var aberto = lista.classList.toggle('aberto');
    botao.setAttribute('aria-expanded', String(aberto));
  });
})();

/* ---------- 3. Etapas "Como funciona" (avançam sozinhas; tocar pausa) ---------- */
(function etapas() {
  var botoes = document.querySelectorAll('.etapa');
  var detalhe = document.getElementById('detalhe-etapa');
  if (!botoes.length || !detalhe) return;
  var atual = 0;
  var timer = null;
  function mostra(i) {
    atual = i;
    botoes.forEach(function (b, n) { b.classList.toggle('ativa', n === i); b.setAttribute('aria-pressed', String(n === i)); });
    detalhe.innerHTML = '';
    var forte = document.createElement('strong');
    forte.textContent = botoes[i].dataset.titulo + '. ';
    detalhe.appendChild(forte);
    detalhe.appendChild(document.createTextNode(botoes[i].dataset.texto));
  }
  botoes.forEach(function (b, n) { b.addEventListener('click', function () { clearInterval(timer); mostra(n); }); });
  mostra(0);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    timer = setInterval(function () { mostra((atual + 1) % botoes.length); }, 2600);
  }
})();

/* ---------- 4. Filtro dos casos reais ---------- */
(function filtros() {
  var botoes = document.querySelectorAll('.filtro');
  var casos = document.querySelectorAll('.caso');
  botoes.forEach(function (b) {
    b.addEventListener('click', function () {
      botoes.forEach(function (x) { x.classList.toggle('ativo', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      var tipo = b.dataset.tipo;
      casos.forEach(function (c) { c.hidden = tipo !== 'todos' && c.dataset.tipos.split(' ').indexOf(tipo) < 0; });
    });
  });
})();

/* ---------- 5. SHA-256 de um arquivo (Web Crypto, dentro do navegador) ---------- */
function sha256(arquivo) {
  return arquivo.arrayBuffer().then(function (dados) { return crypto.subtle.digest('SHA-256', dados); }).then(function (h) {
    return Array.prototype.map.call(new Uint8Array(h), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}
function caminho(arquivo) {
  var p = (arquivo.webkitRelativePath || arquivo.name).replace(/\\/g, '/');
  var i = p.indexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

/* ---------- 6. Verificador de backup (compara origem e cópia) ---------- */
(function verificador() {
  var origem = document.getElementById('pasta-origem');
  var copia = document.getElementById('pasta-copia');
  var botao = document.getElementById('comparar');
  var saida = document.getElementById('resultado-backup');
  if (!origem || !copia || !botao || !saida) return;
  function pronto() { botao.disabled = !(origem.files.length && copia.files.length); }
  origem.addEventListener('change', pronto);
  copia.addEventListener('change', pronto);
  botao.addEventListener('click', async function () {
    botao.disabled = true;
    saida.hidden = false;
    saida.textContent = 'Comparando…';
    var o = new Map(); var c = new Map();
    Array.from(origem.files).forEach(function (f) { o.set(caminho(f), f); });
    Array.from(copia.files).forEach(function (f) { c.set(caminho(f), f); });
    var iguais = 0; var problemas = [];
    for (var [p, f] of o) {
      var g = c.get(p);
      if (!g) { problemas.push(['Faltando na cópia', p]); continue; }
      if (g.size !== f.size) { problemas.push(['Tamanho diferente', p]); continue; }
      try {
        var a = await sha256(f); var b = await sha256(g);
        if (a === b) iguais++; else problemas.push(['Conteúdo diferente (SHA-256)', p]);
      } catch (e) { problemas.push(['Não foi possível ler', p]); }
    }
    c.forEach(function (_, p) { if (!o.has(p)) problemas.push(['Só na cópia', p]); });
    var confiavel = o.size > 0 && !problemas.some(function (x) { return x[0] !== 'Só na cópia'; });
    saida.innerHTML = '';
    var titulo = document.createElement('p');
    var forte = document.createElement('strong');
    forte.textContent = confiavel ? '✔ Cópia confiável. ' : '✘ Esta cópia não é confiável. ';
    forte.style.color = confiavel ? 'var(--ok)' : 'var(--erro)';
    titulo.appendChild(forte);
    titulo.appendChild(document.createTextNode(iguais + ' arquivo(s) idêntico(s) · ' + problemas.length + ' aviso(s).'));
    saida.appendChild(titulo);
    if (problemas.length) {
      var ul = document.createElement('ul');
      problemas.slice(0, 200).forEach(function (x) { var li = document.createElement('li'); li.textContent = x[0] + ': ' + x[1]; ul.appendChild(li); });
      saida.appendChild(ul);
    }
    pronto();
  });
})();

/* ---------- 7. Checklist 3-2-1 (lembra o que foi marcado) ---------- */
(function checklist() {
  var caixas = document.querySelectorAll('.lista-checagem input');
  var barra = document.getElementById('barra-321');
  var texto = document.getElementById('texto-321');
  if (!caixas.length) return;
  var feitos = [];
  try { feitos = JSON.parse(localStorage.getItem('manual-321') || '[]'); } catch (e) { feitos = []; }
  function atualiza() {
    var n = 0;
    caixas.forEach(function (c) { if (c.checked) n++; });
    if (barra) barra.style.width = (n / caixas.length) * 100 + '%';
    if (texto) texto.textContent = n + '/' + caixas.length + (n === caixas.length ? ' — seus dados estão bem protegidos.' : ' — ainda há riscos como os dos casos acima.');
    try { localStorage.setItem('manual-321', JSON.stringify(Array.from(caixas).filter(function (c) { return c.checked; }).map(function (c) { return c.value; }))); } catch (e) { /* */ }
  }
  caixas.forEach(function (c) { c.checked = feitos.indexOf(c.value) >= 0; c.addEventListener('change', atualiza); });
  atualiza();
})();

/* ---------- 8. Teste de hash ao vivo (nome não importa; conteúdo sim) ---------- */
(function hashAoVivo() {
  var a = document.getElementById('texto-a');
  var b = document.getElementById('texto-b');
  var ha = document.getElementById('hash-a');
  var hb = document.getElementById('hash-b');
  var veredito = document.getElementById('veredito-hash');
  if (!a || !b) return;
  function calcula() {
    Promise.all([a.value, b.value].map(function (t) { return sha256(new Blob([t])); })).then(function (h) {
      ha.textContent = h[0]; hb.textContent = h[1];
      veredito.textContent = h[0] === h[1] ? '✔ Conteúdo idêntico: para o detector, é uma cópia.' : '✘ Conteúdos diferentes: um único caractere muda o hash inteiro.';
    });
  }
  a.addEventListener('input', calcula); b.addEventListener('input', calcula);
  calcula();
})();
