import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    'background/service_worker': './src/background/service_worker.js',
    'popup/popup': './src/popup/popup.js',
    'content/amazon': './src/content/amazon.js',
    'content/flipkart': './src/content/flipkart.js',
    'content/ebay': './src/content/ebay.js',
    'content/walmart': './src/content/walmart.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'src/[name].js',
    clean: true,
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { modules: false }]],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/popup/index.html', to: 'src/popup/index.html' },
        { from: 'src/popup/styles.css', to: 'src/popup/styles.css' },
        { from: 'icons', to: 'icons' },
        { from: 'src/content/platforms', to: 'src/content/platforms' },
        { from: 'src/content/shared', to: 'src/content/shared' },
        { from: 'src/lib', to: 'src/lib' },
      ],
    }),
  ],
  optimization: {
    minimize: false, // Keep readable for debugging
  },
  performance: {
    hints: 'warning', // Show warnings but don't fail build
    maxAssetSize: 500000, // 500 KB - allow larger icons temporarily
  },
};

