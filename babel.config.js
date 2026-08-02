module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '18',
        chrome: '120' // Electron 28 uses Chrome 120
      },
      useBuiltIns: 'usage',
      corejs: 3
    }],
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  plugins: [
    '@babel/plugin-transform-flow-strip-types',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-runtime'
  ],
  env: {
    production: {
      plugins: ['transform-react-remove-prop-types']
    },
    development: {
      plugins: []
    }
  }
};
