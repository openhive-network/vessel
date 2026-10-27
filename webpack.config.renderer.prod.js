/**
 * Build config for electron renderer process
 */

const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { merge } = require('webpack-merge');
const baseConfig = require('./webpack.config.base');

module.exports = merge(baseConfig, {
  mode: 'production',

  devtool: 'source-map',

  target: 'electron-renderer',

  entry: './app/index',

  output: {
    path: path.join(__dirname, 'app/dist'),
    publicPath: '../dist/'
  },

  module: {
    rules: [
      // Extract all .global.css to style.css as is
      {
        test: /\.global\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              // semantic-ui inlines fonts as data: URIs webpack cannot parse;
              // they need no bundling.
              url: { filter: url => !url.startsWith('data:') },
            }
          }
        ],
      },
      // Pipe other styles through css modules and append to style.css
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[name]__[local]__[hash:base64:5]',
                namedExport: false,
                exportLocalsConvention: 'as-is',
              },
              importLoaders: 1,
            }
          }
        ],
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
    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),

    new MiniCssExtractPlugin({ filename: 'style.css' }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true'
    }),
  ],
});
