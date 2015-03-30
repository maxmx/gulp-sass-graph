## Sass Import graph resolver

Partials piped in the stream will resolve their parents and push then downstream to get compiled by Sass

###### Note: This is a working, absolute paths only, version of [gulp-sass-graph](https://github.com/lox/gulp-sass-graph) which is no longer maintained.

## Install

Install with [npm](https://npmjs.org/package/gulp-sass-graph)

```
npm install --save-dev gulp-sass-graph-abs
```


## Example

The included paths must be an array of absolute paths.
Make sure to also include absolute paths to your libraries.

```js

var cssResources = [path.join(__dirname, 'src/css')],
	bourbonResources = bourbon.includePaths, // Array of paths from bourbon.
	paths = cssResources.concat(bourbonResources);

gulp.task('watch-sass', function(cb) {
  return watch('src/css/**/*.scss')
    .pipe(sassGraph(paths))
    .pipe(sass({includePaths: paths}))
    .pipe(gulp.dest('dist/css'));
});
```

## License

MIT © [Lachlan Donald](http://lachlan.me)
