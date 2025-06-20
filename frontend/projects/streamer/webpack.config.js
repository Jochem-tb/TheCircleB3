const path = require('path');

module.exports = {
  resolve: {
    alias: {
      events: require.resolve('events/'),
      util: require.resolve('util/'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
      stream: require.resolve('stream-browserify')
    },
    fallback: {
      fs: false,
      net: false,
      tls: false
    }
  }
};
