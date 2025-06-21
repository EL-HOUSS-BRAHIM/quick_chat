
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: {
    'main': './app/frontend/index.js',
    'admin': './app/frontend/pages/admin.js',
    'chat': './app/frontend/pages/chat.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
    clean: true,
    publicPath: '/dist/'
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxSize: 244000, // 244KB target
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          maxSize: 244000
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          maxSize: 244000,
          enforce: true
        },
        ui: {
          test: /[\\/]components[\\/]ui[\\/]/,
          name: 'ui-components',
          chunks: 'all',
          maxSize: 200000
        },
        webrtc: {
          test: /[\\/](WebRTC|webrtc|call|video)[\\/]/,
          name: 'webrtc',
          chunks: 'async',
          maxSize: 200000
        }
      }
    },
    usedExports: true,
    sideEffects: false,
    minimize: true,
    minimizer: [
      new (require('terser-webpack-plugin'))({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        }
      })
    ]
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-syntax-dynamic-import']
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/frontend')
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
};
