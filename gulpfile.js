var gulp = require('gulp');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var watchify = require('watchify');
var assign = require('lodash.assign');
var browserify = require('browserify');
var browserSync = require('browser-sync').create();
var $ = require('gulp-load-plugins')();

gulp.task('bundle', function () {
	var customOpts = {
		entries: ['./src/game.js'],
		debug: true
	};
	var opts = assign({}, watchify.args, customOpts);

	var bundler = watchify(browserify(opts));

	bundler.on('update', bundle);

	function bundle() {
		return bundler.bundle()
			.on('error', function (err) {
				$.util.log(err);
				browserSync.notify('Browserify error');
				this.emit('end');
			})
			.pipe(source('game.js'))
			.pipe(buffer())
			.pipe($.sourcemaps.init({loadMaps: true}))
			.pipe($.concat('game.js'))
			.pipe($.uglify())
			.pipe($.sourcemaps.write('./'))
			.pipe(gulp.dest('./'))
			.pipe(browserSync.stream({once: true}));
	}

	return bundle();
});

gulp.task('default', ['bundle'], function(cb) {
	browserSync.init({
		server: {
			baseDir: './'
		}
	});

	gulp.watch('src/**/*.js', ['bundle']);
});

