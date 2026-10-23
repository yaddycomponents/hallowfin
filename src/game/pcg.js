// PCG32 (PCG-XSH-RR, 64-bit state, 32-bit output), after pcg-random.org's
// pcg_basic.c. Chosen over Math.random because it is reproducible: the same
// seed replays the same draw, so anyone can audit the picker. BigInt holds the
// 64-bit state exactly; we only need a handful of numbers per round.

const MASK = (1n << 64n) - 1n
const MULT = 6364136223846793005n

// seed: BigInt (64-bit); stream: which independent sequence (names, questions, dares)
export function pcg32(seed, stream) {
  let state = 0n
  const inc = ((BigInt(stream) << 1n) | 1n) & MASK

  const next = () => {
    const old = state
    state = (old * MULT + inc) & MASK
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn)
    const rot = Number(old >> 59n)
    return ((xorshifted >>> rot) | (xorshifted << (-rot & 31))) >>> 0
  }

  // pcg32_srandom_r: step, mix in the seed, step
  next()
  state = (state + BigInt.asUintN(64, seed)) & MASK
  next()

  return {
    next,
    // pcg32_boundedrand_r: uniform in [0, n). Values below 2^32 mod n are
    // rejected, so every outcome gets exactly the same share (no modulo bias).
    below(n) {
      const threshold = (2 ** 32 - n) % n
      for (;;) {
        const r = next()
        if (r >= threshold) return r % n
      }
    },
  }
}

// Fisher–Yates with a PCG stream: a fair random order of 0..n-1
export function shuffled(n, rng) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = rng.below(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A fresh 64-bit seed from the OS's crypto source, as 16 hex digits
export function newSeed() {
  const w = crypto.getRandomValues(new Uint32Array(2))
  return w[0].toString(16).padStart(8, '0') + w[1].toString(16).padStart(8, '0')
}

export const parseSeed = (hex) => BigInt('0x' + (hex.replace(/[^0-9a-f]/gi, '') || '0'))

// One stream per thing we draw, so editing the dare list can't change who gets picked
export const STREAM = { players: 1, questions: 2, dares: 3 }

// The k-th pass through a list of n items (k = 0, 1, …): each pass is a fresh
// shuffle drawn from the same stream, so lists that run out (questions,
// dares) reshuffle without repeats inside a pass, and the whole thing is
// reproducible from the seed.
export function orderAt(seedHex, stream, n, pass) {
  const rng = pcg32(parseSeed(seedHex), stream)
  let order = []
  for (let k = 0; k <= pass; k++) order = shuffled(n, rng)
  return order
}

// The item index for draw number t (0-based) from a list of n
export function drawIndex(seedHex, stream, n, t) {
  if (!n) return -1
  return orderAt(seedHex, stream, n, Math.floor(t / n))[t % n]
}
