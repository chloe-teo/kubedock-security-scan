const fs = require('fs');

fs.copyFileSync('styles.css', 'dist/styles.css');
fs.copyFileSync('tab.html', 'dist/tab.html');
fs.mkdirSync('dist/lib', { recursive: true });
fs.copyFileSync('node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js', 'dist/lib/VSS.SDK.min.js');
