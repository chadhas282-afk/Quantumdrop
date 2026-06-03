/**
 * Generates a cryptographically random, human-readable room ID.
 * Format: adjective-noun-number (e.g., "cosmic-falcon-7842")
 */

const ADJECTIVES = [
  "cosmic", "quantum", "nebula", "stellar", "lunar", "solar", "astral", "void",
  "plasma", "photon", "ionic", "neural", "cyber", "digital", "neon", "binary",
  "vector", "matrix", "orbital", "radiant", "spectral", "thermal", "ultra",
  "vivid", "xenon", "zephyr", "atomic", "blazing", "cryptic", "dynamic",
  "electric", "fusion", "galactic", "hypnotic", "infinite", "kinetic",
];

const NOUNS = [
  "falcon", "phoenix", "vortex", "nebula", "quasar", "pulsar", "comet",
  "prism", "cipher", "nexus", "vertex", "zenith", "apex", "delta", "sigma",
  "omega", "alpha", "beta", "gamma", "lambda", "epsilon", "theta", "kappa",
  "synapse", "cortex", "neuron", "photon", "electron", "proton", "neutron",
  "cascade", "torrent", "beacon", "signal", "vector", "matrix", "cipher",
];

function getRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function generateRoomId(): string {
  const adj = ADJECTIVES[getRandomInt(ADJECTIVES.length)];
  const noun = NOUNS[getRandomInt(NOUNS.length)];
  const num = getRandomInt(9000) + 1000; // 4-digit number
  return `${adj}-${noun}-${num}`;
}
