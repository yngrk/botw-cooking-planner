// Turns the recipe tables in docs/cooking-rules.md (appendix A) into data/recipes.json.
// Run: node scripts/extract-recipes.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync(new URL('../docs/cooking-rules.md', import.meta.url), 'utf8')
const appendix = md.slice(md.indexOf('## A. Full recipe table'))
const [multiPart, singlePart] = appendix.split('### SingleRecipes')

// "#CookFruit" -> { tag }, "apple" -> { id }; the unresolved hash matches no ingredient.
function alt(token) {
  token = token.trim()
  if (token.startsWith('#<unresolved')) return null
  return token.startsWith('#') ? { tag: token.slice(1) } : { id: token }
}

function rows(part) {
  return part
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
}

function names(cell) {
  const [en, de] = cell.split(' / ')
  return { en, de }
}

const recipes = rows(multiPart).map(([, result, internal, hb, slots]) => ({
  ...names(result),
  internal,
  hb: hb ? Number(hb) : 0,
  slots: [...slots.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].split(' / ').map(alt).filter(Boolean)),
}))

const singleRecipes = rows(singlePart).map(([, result, internal, hb, rule]) => {
  const oneOf = rule.match(/^one of: (.+)$/)
  const tag = rule.match(/^has tag: #(\w+)$/)
  if (!oneOf && !tag) throw new Error(`Unknown single recipe rule: ${rule}`)
  return {
    ...names(result),
    internal,
    hb: hb ? Number(hb) : 0,
    match: oneOf ? oneOf[1].split(', ').map((id) => ({ id })) : [{ tag: tag[1] }],
  }
})

writeFileSync(
  new URL('../data/recipes.json', import.meta.url),
  JSON.stringify({ recipes, singleRecipes }, null, 1) + '\n',
)
console.log(`${recipes.length} recipes, ${singleRecipes.length} single recipes`)
