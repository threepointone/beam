build: 
	browserify -r ./index.js -s beam -o dist/beam.js
	cat dist/beam.js | uglifyjs --mangle --compress -o dist/beam.min.js
	cat dist/beam.min.js | gzip | wc -c

.PHONY: build
	