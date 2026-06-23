const fs = require('fs');

fs.copyFileSync('styles.css', 'dist/styles.css');
fs.mkdirSync('dist/images', { recursive: true });
fs.copyFileSync('images/logo.png', 'dist/images/logo.png');
fs.mkdirSync('lib', { recursive: true });
fs.copyFileSync('node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js', 'lib/VSS.SDK.min.js');
