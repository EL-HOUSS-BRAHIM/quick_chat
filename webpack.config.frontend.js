const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const isDevelopment = process.env.NODE_ENV !== 'production';
const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  
  // Entry points for the enhanced organized structure
  entry: {
    // Main application entry point
    'frontend': './app/frontend/index.js',
    
    // Individual page bundles with optimized loading
    'chat': './app/frontend/pages/chat.js',
    'dashboard': './app/frontend/pages/dashboard.js',
    'profile': './app/frontend/pages/profile.js',
    'admin': './app/frontend/pages/admin.js',
    
    // Service worker entry
    'sw': './app/frontend/sw.js',
    
    // Vendor chunk for common dependencies
    'vendor': [
      // Core utilities that are used across multiple components
      './app/frontend/utils/logger.js',
      './app/frontend/services/EventBus.js',
      './app/frontend/services/apiClient.js'
    ]
  },
  
  output: {
    filename: isDevelopment ? '[name].js' : '[name].[contenthash:8].js',
    chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash:8].chunk.js',
    path: path.resolve(__dirname, 'assets/js/dist/frontend'),
    clean: true,
    publicPath: '/assets/js/dist/frontend/',
    
    // Optimized output for modern browsers
    environment: {
      arrowFunction: true,
      bigIntLiteral: false,
      const: true,
      destructuring: true,
      dynamicImport: true,
      forOf: true,
      module: true
    }
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
      '@tests': path.resolve(__dirname, 'app/frontend/tests'),
    },
    
    // Fallback for Node.js core modules
    fallback: {
      "crypto": false,
      "stream": false,
      "buffer": false
    }
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
              '@babel/plugin-proposal-class-properties',
              ['@babel/plugin-proposal-decorators', { legacy: true }]
            ],
            cacheDirectory: true,
            cacheCompression: false
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          isDevelopment ? 'style-loader' : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                localIdentName: isDevelopment ? '[local]--[hash:base64:5]' : '[hash:base64:8]'
              },
              importLoaders: 1
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  'autoprefixer',
                  'cssnano'
                ]
              }
            }
          }
        ]
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          isDevelopment ? 'style-loader' : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                localIdentName: isDevelopment ? '[local]--[hash:base64:5]' : '[hash:base64:8]'
              },
              importLoaders: 2
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  'autoprefixer',
                  'cssnano'
                ]
              }
            }
          },
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: 'asset',
        generator: {
          filename: 'images/[name].[contenthash:8][ext]'
        },
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024 // 8kb
          }
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[contenthash:8][ext]'
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/,
        type: 'asset/resource',
        generator: {
          filename: 'media/[name].[contenthash:8][ext]'
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
