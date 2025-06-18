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
          name(module) {
            // Get the name of the npm package
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            // Return a nice name
            return `vendor.${packageName.replace('@', '')}`;
          },
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: -20
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
