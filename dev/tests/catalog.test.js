// The roster: every game has a file, a blurb and an icon; ids are unique;
// the dev harness knows every game.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const { load, assert, test, ROOT } = require('./lib')

const cat = load('engine/GamesCatalog.js')
const icons = load('engine/icons.js')

test('ids are unique', () => {
  const seen = {}
  for (const g of cat.GAMES) { assert(!seen[g.id], 'duplicate id ' + g.id); seen[g.id] = true }
})

test('every game has its QML file, a type, a blurb and an icon', () => {
  for (const g of cat.GAMES) {
    assert(g.qml && fs.existsSync(path.join(ROOT, 'games', g.qml)), g.id + ': missing games/' + g.qml)
    assert(cat.TYPE_ORDER.indexOf(g.type) >= 0, g.id + ': unknown type ' + g.type)
    assert(cat.BLURBS[g.id], g.id + ': no blurb')
    assert(icons.ICONS[g.id], g.id + ': no icon (would fall back to the die)')
  }
})

test('every QML game declares the gameId the catalog uses', () => {
  for (const g of cat.GAMES) {
    const src = fs.readFileSync(path.join(ROOT, 'games', g.qml), 'utf8')
    assert(src.includes(`gameId: "${g.id}"`), g.qml + ' does not declare gameId "' + g.id + '"')
  }
})

test('icons draw without throwing', () => {
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => ((o[k] = v), true) })
  const c = { fg: '#fff', dim: '#888', bg: '#000', accent: '#0af', danger: '#f00', soft: '#08a', warm: '#aa0', tone: ['a', 'b', 'c', 'd', 'e', 'f'] }
  for (const g of cat.GAMES) icons.draw(ctx, g.id, 0, 0, 32, c)
})

test('dev harness map matches the catalog', () => {
  execFileSync('node', [path.join(ROOT, 'dev', 'tools', 'sync-harness.js'), '--check'], { stdio: 'pipe' })
})

test('manifest and README game counts match the catalog', () => {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
  const tens = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
  const n = cat.GAMES.length
  const under100 = m => m < 20 ? words[m] : tens[Math.floor(m / 10)] + (m % 10 ? '-' + words[m % 10] : '')
  const word = n < 100 ? under100(n) : 'one hundred' + (n % 100 ? ' and ' + under100(n % 100) : '')
  const cap = word[0].toUpperCase() + word.slice(1)
  const manifest = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
  assert(manifest.includes(cap + ' small games'), 'manifest.json should say "' + cap + ' small games"')
  assert(readme.includes(cap + ' small games'), 'README.md should say "' + cap + ' small games"')
})
