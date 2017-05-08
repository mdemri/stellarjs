const path = require('path');

function webpackConfig(context) {
  return {
    context: __dirname,
    resolve: {
      extensions: ['.js'],
    },
    entry: {
      'index': `${context}/src/index.browser.js`,
    },
    output: {
      path: path.resolve(context, 'dist'),
      filename: '[name].js',
    },
    module: {
      loaders: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['es2015', { modules: false }]
              ],
            },
          },
        },
      ],
    },
    plugins: [],
  };
}

module.exports = webpackConfig;
