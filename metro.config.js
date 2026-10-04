const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit workers to prevent "Jest worker ran out of memory" on constrained systems
config.maxWorkers = 2;

module.exports = config;
