function hashString(input = '') {
  const text = String(input)
  let hash = 2166136261

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function pickVariant(seed, variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null
  return variants[hashString(seed) % variants.length]
}

function chance(seed, probability) {
  const threshold = Math.max(0, Math.min(1, Number(probability) || 0))
  return (hashString(seed) % 10000) / 10000 < threshold
}

export { hashString, pickVariant, chance }
