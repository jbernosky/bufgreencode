var autoprefixer = require('autoprefixer');
var browserSync = require('browser-sync').create();
var cleancss = require('gulp-clean-css');
var concat = require('gulp-concat');
var del = require('del');
var gulp = require('gulp');
var gutil = require('gulp-util');
var imagemin = require('gulp-imagemin');
var notify = require('gulp-notify');
var postcss = require('gulp-postcss');
var rename = require('gulp-rename');
var exec = require('gulp-exec');
var sass = require('gulp-sass');
var terser = require('gulp-terser');

sass.compiler = require('node-sass');

var paths = require('./_assets/gulp_config/paths');

// Uses Sass compiler to process styles, adds vendor prefixes, minifies, then
// outputs file to the appropriate location.
gulp.task('build:styles:main', function () {
    var style = gulp.src(paths.sassFiles + '/main.scss')
        .pipe(sass({
            outputStyle: 'compressed'
        }).on('error', sass.logError))
        .pipe(postcss([autoprefixer({
            browsers: ['last 2 versions']
        })]))
        .pipe(cleancss())
        .pipe(gulp.dest(paths.jekyllCssFiles))
        .pipe(gulp.dest(paths.siteCssFiles))
        .pipe(browserSync.stream())
        .on('error', gutil.log);
    return style;
});


// Builds all styles.
gulp.task('build:styles', gulp.series('build:styles:main'));

gulp.task('clean:styles', function (callback) {
    del([paths.jekyllCssFiles + 'main.css',
        paths.siteCssFiles + 'main.css'
    ]);
    callback();
});

// Concatenates and uglifies global JS files and outputs result to the
// appropriate location.
gulp.task('build:scripts:global', function () {
    return gulp.src([
        paths.jsFiles + '/global' + paths.jsPattern,
        paths.jsFiles + '/global/*.js'
    ])
        .pipe(concat('main.js'))
        .pipe(terser())
        .pipe(gulp.dest(paths.jekyllJsFiles))
        .pipe(gulp.dest(paths.siteJsFiles))
        .on('error', gutil.log);
});

gulp.task('clean:scripts', function (callback) {
    del([paths.jekyllJsFiles + 'main.js', paths.siteJsFiles + 'main.js']);
    callback();
});

// Builds all scripts.
gulp.task('build:scripts', gulp.series('build:scripts:global'));

// Optimizes and copies image files.
gulp.task('build:images', function () {
    return gulp.src(paths.imageFilesGlob)
        .pipe(imagemin())
        .pipe(gulp.dest(paths.jekyllImageFiles))
        .pipe(gulp.dest(paths.siteImageFiles))
        .pipe(browserSync.stream());
});

gulp.task('clean:images', function (callback) {
    del([paths.jekyllImageFiles, paths.siteImageFiles]);
    callback();
});

// Places Font Awesome fonts in proper location.
gulp.task('fontawesome', function () {
    return gulp.src(paths.fontFiles + '/font-awesome/**.*')
        .pipe(rename(function (path) {
            path.dirname = '';
        }))
        .pipe(gulp.dest(paths.jekyllFontFiles))
        .pipe(gulp.dest(paths.siteFontFiles))
        .pipe(browserSync.stream())
        .on('error', gutil.log);
});

// Copies fonts.
gulp.task('build:fonts', gulp.series('fontawesome'));

gulp.task('clean:fonts', function (callback) {
    del([paths.jekyllFontFiles, paths.siteFontFiles]);
    callback();
});

// Runs jekyll build command.
gulp.task('build:jekyll', function () {
    var options = {
        continueOnError: false, // default = false, true means don't emit error event
        pipeStdout: false, // default = false, true means stdout is written to file.contents
        customTemplatingThing: "test" // content passed to lodash.template()
    };
    var reportOptions = {
        err: true, // default = true, false means don't write err
        stderr: true, // default = true, false means don't write stderr
        stdout: true // default = true, false means don't write stdout
    };
    var shellCommand = 'bundle exec jekyll build --config _config.yml';

    return gulp.src('/')
        .pipe(exec(shellCommand, options))
        .pipe(exec.reporter(reportOptions));
});

// Runs jekyll build command using test config.
gulp.task('build:jekyll:test', function () {
    var options = {
        continueOnError: false, // default = false, true means don't emit error event
        pipeStdout: false, // default = false, true means stdout is written to file.contents
        customTemplatingThing: "test" // content passed to lodash.template()
    };
    var reportOptions = {
        err: true, // default = true, false means don't write err
        stderr: true, // default = true, false means don't write stderr
        stdout: true // default = true, false means don't write stdout
    };
    var shellCommand = 'bundle exec jekyll build --config _config.yml,_config.test.yml';

    return gulp.src('/')
        .pipe(exec(shellCommand, options))
        .pipe(exec.reporter(reportOptions));
});

// Deletes the entire _site directory.
gulp.task('clean:jekyll', function (callback) {
    del(['_site']);
    callback();
});

gulp.task('clean', gulp.series('clean:jekyll', 'clean:fonts', 'clean:images', 'clean:scripts', 'clean:styles'));

// Builds site anew.
gulp.task('build', gulp.series('clean', 'build:scripts', 'build:images', 'build:styles', 'build:fonts', 'build:jekyll'));

// Builds site anew using test config.
gulp.task('build:test', gulp.series('clean', 'build:scripts', 'build:images', 'build:styles', 'build:fonts', 'build:jekyll:test'));

// Default Task: builds site.
gulp.task('default', gulp.series('build'));

// Special tasks for building and then reloading BrowserSync.
gulp.task('build:jekyll:watch', gulp.series('build:jekyll:test', function (callback) {
    browserSync.reload();
    callback();
}));

gulp.task('build:scripts:watch', gulp.series('build:scripts', function (callback) {
    browserSync.reload();
    callback();
}));

// Static Server + watching files.
// Note: passing anything besides hard-coded literal paths with globs doesn't
// seem to work with gulp.watch().
gulp.task('serve', gulp.series('build:test', function () {

    browserSync.init({
        server: paths.siteDir,
        ghostMode: false, // Toggle to mirror clicks, reloads etc. (performance)
        logFileChanges: true,
        logLevel: 'debug',
        open: true // Toggle to automatically open page when starting.
    });

    // Watch site settings.
    gulp.watch(['_config.yml'], gulp.series('build:jekyll:watch'));

    // Watch .scss files; changes are piped to browserSync.
    gulp.watch('_assets/styles/**/*.scss', gulp.series('build:styles'));

    // Watch .js files.
    gulp.watch('_assets/js/**/*.js', gulp.series('build:scripts:watch'));

    // Watch image files; changes are piped to browserSync.
    gulp.watch('_assets/img/**/*', gulp.series('build:images'));

    // Watch posts.
    gulp.watch('_posts/**/*.+(md|markdown|MD)', gulp.series('build:jekyll:watch'));

    // Watch drafts if --drafts flag was passed.
    if (module.exports.drafts) {
        gulp.watch('_drafts/*.+(md|markdown|MD)', gulp.series('build:jekyll:watch'));
    }

    // Watch html and markdown files.
    gulp.watch(['**/*.+(html|md|markdown|MD)', '!_site/**/*.*'], gulp.series('build:jekyll:watch'));

    // Watch RSS feed XML files.
    gulp.watch('**.xml', gulp.series('build:jekyll:watch'));

    // Watch data files.
    gulp.watch('_data/**.*+(yml|yaml|csv|json)', gulp.series('build:jekyll:watch'));

    // Watch favicon.png.
    gulp.watch('favicon.png', gulp.series('build:jekyll:watch'));
}));

// Updates Ruby gems
gulp.task('update:bundle', function () {
    return gulp.src('')
        .pipe(exec('bundle install'))
        .pipe(exec('bundle update'))
        .pipe(notify({
            message: 'Bundle Update Complete'
        }))
        .on('error', gutil.log);
});
