/**
 * Build System Configuration
 * Enhanced build configuration for development and production
 */

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const WorkboxPlugin = require('workbox-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';
const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  
  entry: {
    main: './assets/js/main.js',
    'module-loader': './assets/js/module-loader.js',
    
    // Core bundles
    core: './assets/js/core/index.js',
    
    // Feature-specific bundles for better code splitting
    chat: './assets/js/features/chat/index.js',
    dashboard: './assets/js/features/dashboard/index.js',
    profile: './assets/js/features/profile/index.js',
    admin: './assets/js/features/admin/index.js',
    webrtc: './assets/js/features/webrtc/index.js',
    
    // New enhanced features
    accessibility: './assets/js/features/accessibility/index.js',
    i18n: './assets/js/features/i18n/index.js',
    mobile: './assets/js/features/mobile/experience-manager.js',
    theme: './assets/js/features/theme/index.js',
    
    // UI components
    ui: './assets/js/ui/index.js',
    
    // Services
    services: './assets/js/services/index.js',
    
    // Utils
    utils: './assets/js/utils/index.js',
    
    // Vendor bundle for third-party libraries
    vendor: ['./assets/js/vendor/index.js']
  },

  output: {
    path: path.resolve(__dirname, 'assets/js/dist'),
    filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
    chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
    publicPath: '/assets/js/dist/',
    clean: true,
    // Enable ES modules
    module: true,
    environment: {
      module: true,
      dynamicImport: true
    }
  },

  experiments: {
    outputModule: true
  },

  resolve: {
    extensions: ['.js', '.mjs', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'assets/js'),
      '@features': path.resolve(__dirname, 'assets/js/features'),
      '@services': path.resolve(__dirname, 'assets/js/services'),
      '@utils': path.resolve(__dirname, 'assets/js/utils'),
      '@ui': path.resolve(__dirname, 'assets/js/ui'),
      '@config': path.resolve(__dirname, 'assets/js/config'),
      '@styles': path.resolve(__dirname, 'assets/scss')
    }
  },

  module: {
    rules: [
      // JavaScript/ES6+ processing
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions', 'not ie <= 11']
                },
                modules: false,
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ],
            plugins: [
              '@babel/plugin-syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-proposal-optional-chaining',
              '@babel/plugin-proposal-nullish-coalescing-operator'
            ]
          }
        }
      },

      // SCSS processing
      {
        test: /\.scss$/,
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevelopment,
              importLoaders: 2
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: isDevelopment,
              postcssOptions: {
                plugins: [
                  'autoprefixer',
                  ...(isDevelopment ? [] : ['cssnano'])
                ]
              }
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: isDevelopment,
              sassOptions: {
                includePaths: [path.resolve(__dirname, 'assets/scss')]
              }
            }
          }
        ]
      },

      // Asset processing
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024 // 8kb
          }
        },
        generator: {
          filename: 'images/[name].[hash][ext]'
        }
      },

      // Font processing
      {
        test: /\.(woff2?|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash][ext]'
        }
      },

      // Audio files
      {
        test: /\.(mp3|wav|ogg|m4a)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'sounds/[name].[hash][ext]'
        }
      }
    ]
  },

  plugins: [
    // Clean build directory
    new CleanWebpackPlugin(),

    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.API_URL': JSON.stringify(process.env.API_URL || '/api'),
      'process.env.WS_URL': JSON.stringify(process.env.WS_URL || '/ws'),
      '__DEV__': isDevelopment,
      '__PROD__': !isDevelopment
    }),

    // Extract CSS
    ...(!isDevelopment ? [
      new MiniCssExtractPlugin({
        filename: '../css/[name].[contenthash].css',
        chunkFilename: '../css/[name].[contenthash].chunk.css'
      })
    ] : []),

    // Service Worker for PWA
    ...(!isDevelopment ? [
      new WorkboxPlugin.GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              }
            }
          }
        ]
      })
    ] : []),

    // Bundle analyzer (only when requested)
    ...(isAnalyze ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: '../../../webpack-bundle-report.html'
      })
    ] : [])
  ],

  optimization: {
    minimize: !isDevelopment,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: !isDevelopment,
            drop_debugger: !isDevelopment
          },
          format: {
            comments: false
          }
        },
        extractComments: false
      }),
      new CssMinimizerPlugin()
    ],

    // Code splitting configuration
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 20
        },
        
        // Common modules shared across features
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
          enforce: true
        },

        // CSS splitting
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true
        }
      }
    },

    // Runtime chunk for better caching
    runtimeChunk: {
      name: 'runtime'
    }
  },

  // Development server configuration
  devServer: {
    contentBase: path.join(__dirname),
    compress: true,
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },

  // Source maps
  devtool: isDevelopment ? 'eval-source-map' : 'source-map',

  // Performance hints
  performance: {
    hints: isDevelopment ? false : 'warning',
    maxEntrypointSize: 512000, // 500kb
    maxAssetSize: 512000
  },

  // Stats configuration
  stats: {
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }
};
