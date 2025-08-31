## Quick Start

Install dependencies: `npm install`

Run Server: `npm run serve`

### Building

For building, `npm run build`:

- Minifies your html file and embeds css
- Strips html/css from your html and prepends your transpiled js code with a `document.write` call that writes your html and css.
- Runs Terser on your code
- Runs RoadRoller on the Terser minified code
- Creates `dist/index.html` with only a script tag and the RoadRollered JS
- Any external assets (images, data files, etc) are also copied to `dist/`
- Zips everything up and places it in `dist/index.zip`
