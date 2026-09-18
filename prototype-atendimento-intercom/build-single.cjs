/* ==========================================================================
   build-single.js — empacota o protótipo num único arquivo .html
   --------------------------------------------------------------------------
   Para mandar por e-mail/Teams: um arquivo, duplo clique, funciona.

   ARMADILHA QUE CUSTOU UM ARQUIVO QUEBRADO: `String.replace` interpreta `$$`,
   `$&`, `$'` e `` $` `` DENTRO do texto de substituição. O app.js usa `$$(sel)`
   como atalho de querySelectorAll, e cada `$$` virava um `$` — o seletor
   múltiplo sumia e o app nem inicializava. O replacement precisa ser uma
   FUNÇÃO, que é entregue literal.
   ========================================================================== */
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const scripts = ['icons.js', 'brand.js', 'data.js', 'app.js'];

// Uma string contendo </style> ou </script> fecharia a tag cedo.
if (/<\/style/i.test(css)) throw new Error('styles.css contem </style');
scripts.forEach((f) => {
  if (/<\/script/i.test(fs.readFileSync(f, 'utf8'))) throw new Error(f + ' contem </script');
});

let out = html.replace('<link rel="stylesheet" href="styles.css" />', () => '<style>\n' + css + '\n    </style>');
scripts.forEach((f) => {
  const src = fs.readFileSync(f, 'utf8');
  const tag = '<script src="' + f + '"></script>';
  if (!out.includes(tag)) throw new Error('tag nao encontrada: ' + tag);
  out = out.replace(tag, () => '<script>\n' + src + '\n    </script>');
});

// Prova de que o `$$` sobreviveu: o app.js tem dezenas deles.
const originalDollar = (fs.readFileSync('app.js', 'utf8').match(/\$\$\(/g) || []).length;
const bundledDollar = (out.match(/\$\$\(/g) || []).length;
if (bundledDollar !== originalDollar) {
  throw new Error('corrupcao de $$: ' + originalDollar + ' no fonte, ' + bundledDollar + ' no bundle');
}
if (/(src|href)="(icons|brand|data|app)\.js"|href="styles\.css"/.test(out)) {
  throw new Error('sobrou referencia externa');
}

fs.writeFileSync('atendimento-unianchieta.html', out);
console.log('gerado: atendimento-unianchieta.html (' + (out.length / 1024).toFixed(0) + ' KB)');
console.log('$$ preservados: ' + bundledDollar);
