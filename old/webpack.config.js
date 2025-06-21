const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

// Check if we're running analysis mode
const isAnalyze = process.argv.includes('--analyze');
const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  entry: {
    // Core application bundles
    'app': './assets/js/core/app.js',
    'admin': './assets/js/features/admin/index.js',
    'chat': './assets/js/features/chat/index.js',
    'dashboard': './assets/js/features/dashboard/index.js',
    'profile': './assets/js/features/profile/index.js',
    'webrtc': './assets/js/features/webrtc/index.js',
    'group-chat': './assets/js/features/chat/group-chat.js',
    'private-chat': './assets/js/features/chat/private-chat.js',
    
    // UI components
    'ui-components': './assets/js/ui/index.js',
    'emoji': './assets/js/features/emoji/index.js',
    
    // Utilities and services
    'utils': './assets/js/utils/index.js',
    'services': './assets/js/services/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    chunkFilename: '[name].[contenthash].chunk.js',
    path: path.resolve(__dirname, 'assets/js/dist'),
    clean: true,
    publicPath: '/assets/js/dist/'
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
            plugins: [
              '@babel/plugin-transform-runtime',
              '@babel/plugin-syntax-dynamic-import'
            ]
          }
        }
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings in development
          // or extracts to separate files in production
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          'sass-loader',
        ],
      },
      {
        test: /\.css$/i,
        use: [isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader, 'css-loader'],
      }
    ]
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: !isDevelopment,
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
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
        groupChat: {
          test: /[\\/]features[\\/]group-chat[\\/]/,
          name: 'group-chat-features',
          chunks: 'all',
          priority: 5
        },
        privateChat: {
          test: /[\\/]features[\\/]private-chat[\\/]/,
          name: 'private-chat-features',
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
          name: 'ui-components-bundle',
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
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  plugins: [
    // CSS extraction plugin
    new MiniCssExtractPlugin({
      filename: isDevelopment ? '[name].css' : '[name].[contenthash].css',
      chunkFilename: isDevelopment ? '[id].css' : '[id].[contenthash].css',
    }),
    // Add bundle analyzer plugin only when in analyze mode
    ...(isAnalyze ? [new BundleAnalyzerPlugin()] : [])
  ],
  resolve: {
    extensions: ['.js', '.json', '.scss', '.css'],
    alias: {
      '@core': path.resolve(__dirname, 'assets/js/core/'),
      '@features': path.resolve(__dirname, 'assets/js/features/'),
      '@ui': path.resolve(__dirname, 'assets/js/ui/'),
      '@services': path.resolve(__dirname, 'assets/js/services/'),
      '@utils': path.resolve(__dirname, 'assets/js/utils/')
    }
  }
};
