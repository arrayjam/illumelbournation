var watchify = require("watchify"),
    browserify = require("browserify"),
    reactify = require("reactify"),
    gulp = require("gulp"),
    less = require("gulp-less"),
    source = require("vinyl-source-stream"),
    buffer = require("vinyl-buffer"),
    gutil = require("gulp-util"),
    sourcemaps = require("gulp-sourcemaps"),
    assign = require("lodash.assign"),
    shell = require("gulp-shell");

var reloadCommand = "chrome-canary-cli reload";

gulp.task("css", function() {
  return bundleCSS(false);
});

gulp.task("refresh-css", function() {
  return bundleCSS(true);
});

gulp.task("watch-css", ["css"], function() {
    return gulp.watch(["./src/*.less"], ["css"]);
});

gulp.task("watch-refresh-css", ["css"], function() {
    return gulp.watch(["./src/*.less"], ["refresh-css"]);
});

gulp.task("js", function() {
  return bundleScripts(false);
});

gulp.task("watch-js", function() {
  return bundleScripts(true);
});

gulp.task("watch-refresh-js", function() {
  return bundleScripts(true, true);
});

gulp.task("release", ["css", "js"]);

gulp.task("default", ["watch-js", "watch-css"]);

gulp.task("watch-refresh", ["watch-refresh-js", "watch-css"]);

function bundleScripts(watch, refresh) {
  var customOpts = {
    entries: ["./src/index.js.jsx"],
    debug: true
  };

  var opts = assign({}, watchify.args, customOpts);

  var bundler = browserify(opts);

  if(watch) {
    console.log("watchify");
    bundler = watchify(bundler);
  }

  bundler.transform(reactify);

  var rebundle = function() {
    var stream = bundler.bundle()
      // log errors if they happen
      .on("error", gutil.log.bind(gutil, "Browserify Error"))
      .pipe(source("bundle.js"))
      // optional, remove if you don't need to buffer file contents
      .pipe(buffer())
      // optional, remove if you dont want sourcemaps
      .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
      // Add transformation tasks to the pipeline here.
      .pipe(sourcemaps.write("./")) // writes .map file
      .pipe(gulp.dest("./dist"));

    if(refresh) {
      stream.pipe(shell([reloadCommand]));
    }

    return stream;
  };

  bundler.on("update", rebundle);
  bundler.on("log", gutil.log); // output build logs to terminal
  return rebundle();
}

function bundleCSS(refresh) {
  var stream = gulp.src("./src/*.less")
    .pipe(less({}))
    .pipe(gulp.dest("./dist"));

  if(refresh) {
    stream.pipe(shell([reloadCommand]));
  }

  return stream;
}
