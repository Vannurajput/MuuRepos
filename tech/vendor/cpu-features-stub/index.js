// Minimal stub used when native cpu-features cannot be built.
module.exports = function cpuFeaturesStub() {
  return {
    hasAES: false,
    hasSHA1: false,
    hasSHA2: false,
    hasSHA512: false
  };
};
