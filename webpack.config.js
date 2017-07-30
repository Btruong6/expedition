const CopyWebpackPlugin = require('copy-webpack-plugin');
const Path = require('path');
const Webpack = require('webpack');
const NodeExternals = require('webpack-node-externals');

const PORT = process.env.DOCKER_PORT || 8080;

const options = {
  cache: true,
  entry: {
    server: [
      './app/app.ts',
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json', '.txt'],
  },
  output: {
    path: Path.join(__dirname, 'dist'),
    publicPath: 'http://localhost:' + PORT + '/',
    filename: '[name].js',
  },
  stats: {
    colors: true,
    reasons: true,
  },
  node: {
    // Don't touch __dirname or __filename (so they work as normal when starting w/ nodejs)
    __dirname: false,
    __filename: false,
  },
  module: {
    rules: [
      // TODO(scott): Enable linting
      // { enforce: 'pre', test: /\.ts$/, loader: 'tslint-loader', exclude: /node_modules/ },
      { test: /\.json$/, loader: 'json-loader' },
      { test: /\.ts$/, loaders: ['awesome-typescript-loader'], exclude: [/\/node_modules\/.*/, /\/dist\/.*/] },
    ]
  },
  target: 'node',
  externals: [NodeExternals()], // Do not bundle anything in node_modules.
  plugins: [
    new Webpack.HotModuleReplacementPlugin(),
    new Webpack.NoEmitOnErrorsPlugin(),
    new Webpack.DefinePlugin({
      VERSION: JSON.stringify(require('./package.json').version)
    }),
    new CopyWebpackPlugin([
      { from: 'newrelic.js' },
      { from: 'app/config_base.json' },
    ]),
    new Webpack.LoaderOptionsPlugin({ // This MUST go last to ensure proper test config
      options: {
        tslint: {
          configuration: {
           rules: {
              quotemark: [true, 'single', 'jsx-double'],
              curly: true,
              noUseBeforeDeclare: true,
              eofline: true,
              radix: true,
              switchDefault: true,
              tripleEquals: true,
              typeofCompare: true,
              useIsnan: true,
              indent: [true, "spaces"],
              // We can add these when we feel like having more style enforcement
              //noUnusedVariables: true,
              noVarKeyword: true,
              preferConst: true,
              trailingComma: true,
            }
          },
          emitErrors: true,
          failOnHint: true,
          tsConfigFile: 'tsconfig.json',
        },
        babel: {
          presets: ["es2015"],
          cacheDirectory: true,
        },
      },
    }),
  ],
};

module.exports = options
