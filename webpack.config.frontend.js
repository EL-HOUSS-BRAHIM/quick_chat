const path = require('path');
const webpack = require('webpack');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  
  // Entry points for the new organized structure
  entry: {
    // Main application entry point
    'frontend': './app/frontend/index.js',
    
    // Individual page bundles
    'chat': './app/frontend/pages/chat.js',
    'dashboard': './app/frontend/pages/dashboard.js',
    'profile': './app/frontend/pages/profile.js',
    'admin': './app/frontend/pages/admin.js'
  },
  
  output: {
    filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
    chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
    path: path.resolve(__dirname, 'assets/js/dist/frontend'),
    clean: true,
    publicPath: '/assets/js/dist/frontend/'
  },
  
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'app/frontend'),
      '@components': path.resolve(__dirname, 'app/frontend/components'),
      '@services': path.resolve(__dirname, 'app/frontend/services'),
      '@state': path.resolve(__dirname, 'app/frontend/state'),
      '@utils': path.resolve(__dirname, 'app/frontend/utils'),
      '@assets': path.resolve(__dirname, 'app/frontend/assets'),
    },
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions', 'not ie <= 8']
                },
                modules: false,
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ],
            plugins: [
              '@babel/plugin-transform-runtime',
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties'
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          isDevelopment ? 'style-loader' : 'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          isDevelopment ? 'style-loader' : 'style-loader',
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[hash][ext][query]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[hash][ext][query]'
        }
      }
    ]
  },
  
  plugins: [    
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.VERSION': JSON.stringify(require('./package.json').version),
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
    })
  ],
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
        },
        // Separate chunk for services
        services: {
          test: /[\\/]app[\\/]frontend[\\/]services[\\/]/,
          name: 'services',
          chunks: 'all',
          priority: 8,
        },
        // Separate chunk for state management
        state: {
          test: /[\\/]app[\\/]frontend[\\/]state[\\/]/,
          name: 'state',
          chunks: 'all',
          priority: 7,
        },
      },
    },
    
    runtimeChunk: {
      name: 'runtime',
    },
  },
  
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',
  
  devServer: isDevelopment ? {
    static: {
      directory: path.join(__dirname, 'assets'),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  } : undefined,
  
  performance: {
    hints: isDevelopment ? false : 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  
  stats: {
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false,
  },
};
