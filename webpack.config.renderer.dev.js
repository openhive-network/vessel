/* eslint global-require: 0, import/no-dynamic-require: 0 */

/**
 * Build config for development electron renderer process that uses
 * Hot-Module-Replacement
 *
 * https://webpack.js.org/concepts/hot-module-replacement/
 */

const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const chalk = require('chalk');
const { merge } = require('webpack-merge');
const { spawn, execSync } = require('child_process');
const baseConfig = require('./webpack.config.base');

const port = process.env.PORT || 1212;
const publicPath = `http://localhost:${port}/dist`;
const dll = path.resolve(process.cwd(), 'dll');
const manifest = path.resolve(dll, 'vendor.json');

/**
 * Warn if the DLL is not built
 */
if (!(fs.existsSync(dll) && fs.existsSync(manifest))) {
  console.log(chalk.black.bgYellow.bold(
    'The DLL files are missing. Sit back while we build them for you with "npm run build-dll"'
  ));
  execSync('npm run build-dll');
}

module.exports = merge(baseConfig, {
  mode: 'development',

  devtool: 'inline-source-map',

  target: 'electron-renderer',

  entry: [
    'react-hot-loader/patch',
    path.join(__dirname, 'app/index.js'),
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`
  },

  module: {
    rules: [
      {
        test: /\.global\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              // semantic-ui inlines fonts as data: URIs webpack cannot parse;
              // they need no bundling.
              url: { filter: url => !url.startsWith('data:') },
            },
          }
        ]
      },
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]__[hash:base64:5]',
                namedExport: false,
                exportLocalsConvention: 'as-is',
              },
              sourceMap: true,
              importLoaders: 1,
            }
          },
        ]
      },
      // WOFF Font
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 10000 } },
        generator: { dataUrl: { mimetype: 'application/font-woff' } },
      },
      // WOFF2 Font
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 10000 } },
        generator: { dataUrl: { mimetype: 'application/font-woff' } },
      },
      // TTF Font
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 10000 } },
        generator: { dataUrl: { mimetype: 'application/octet-stream' } },
      },
      // EOT Font
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/resource',
      },
      // SVG Font
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 10000 } },
        generator: { dataUrl: { mimetype: 'image/svg+xml' } },
      },
      // Common Image Formats
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        type: 'asset/inline',
      }
    ]
  },

  plugins: [
    new webpack.DllReferencePlugin({
      context: process.cwd(),
      manifest: require(manifest),
      sourceType: 'var',
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }),
  ],

  optimization: {
    emitOnErrors: false,
  },

  watchOptions: {
    aggregateTimeout: 300,
    poll: 100
  },

  devServer: {
    port,
    compress: true,
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: path.join(__dirname, 'dist'),
    devMiddleware: {
      publicPath,
      stats: 'errors-only',
    },
    // The page is loaded from file://, so the HMR client cannot derive the
    // server's address from it.
    client: {
      webSocketURL: `ws://localhost:${port}/ws`,
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false,
    },
    onListening() {
      if (process.env.START_HOT) {
        spawn(
          'npm',
          ['run', 'start-hot-renderer'],
          { shell: true, env: process.env, stdio: 'inherit' }
        )
          .on('close', code => process.exit(code))
          .on('error', spawnError => console.error(spawnError));
      }
    }
  },
});
