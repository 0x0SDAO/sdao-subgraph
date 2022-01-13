require('babel-register')
require('babel-polyfill')
const HDWalletProvider = require('truffle-hdwallet-provider')

module.exports = {
  networks: {
    local: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    testnet: {
      provider: function() {
        return new HDWalletProvider(
          process.env.PRIVATE_KEY,
          `https://data-seed-prebsc-1-s1.binance.org:8545/`
        )
      },
      network_id: '97',
    },
  },
  compilers: {
    solc: {
      version: '0.4.25'    // Fetch exact version from solc-bin (default: truffle's version)
    }
  }
}
