const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// Check if we're running analysis mode
const isAnalyze = process.argv.includes('--analyze');

module.exports = {
  entry: {
    // Core application bundles
    'app': './assets/js/core/app.js',
    'admin': './assets/js/features/admin/index.js',
    'chat': './assets/js/features/chat/index.js',
    'dashboard': './assets/js/features/dashboard/index.js',
    'profile': './assets/js/features/profile/index.js',
    'pwa': './assets/js/pwa-manager.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'assets/js/dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  optimization: {
    minimizer: [new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
        },
      },
    })],
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: Infinity,
      minSize: 20000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: -20
        },
        chat: {
          test: /[\\/]features[\\/]chat[\\/]/,
          name: 'chat-features',
          chunks: 'all',
          priority: 5
        },
        admin: {
          test: /[\\/]features[\\/]admin[\\/]/,
          name: 'admin-features',
          chunks: 'all',
          priority: 5
        },
        profile: {
          test: /[\\/]features[\\/]profile[\\/]/,
          name: 'profile-features',
          chunks: 'all',
          priority: 5
        },
        webrtc: {
          test: /[\\/]features[\\/]webrtc[\\/]/,
          name: 'webrtc-features',
          chunks: 'all',
          priority: 5
        },
        ui: {
          test: /[\\/]ui[\\/]/,
          name: 'ui-components',
          chunks: 'all',
          priority: 3
        },
        utils: {
          test: /[\\/]utils[\\/]/,
          name: 'utilities',
          chunks: 'all',
          priority: 2
        }
      }
    }
  },
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
  plugins: [
    // Add bundle analyzer plugin only when in analyze mode
    ...(isAnalyze ? [new BundleAnalyzerPlugin()] : [])
  ]
};
