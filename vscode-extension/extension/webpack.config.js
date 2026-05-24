const path = require('path');

module.exports = {
  mode: 'development',
  devtool: 'nosources-source-map',
  entry: {
    extension: './src/extension.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  target: 'node',
  externals: {
    vscode: 'commonjs vscode',
    fs: 'commonjs fs',
    path: 'commonjs path',
    child_process: 'commonjs child_process',
    util: 'commonjs util',
  }
};
