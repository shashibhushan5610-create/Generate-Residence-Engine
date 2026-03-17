const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'AdvancedTestEngine_DynamicGeneration.jsx');
const htmlPath = path.join(__dirname, 'test-advanced.html');

let jsxCode = fs.readFileSync(jsxPath, 'utf8');

// Transform React imports
jsxCode = jsxCode.replace(/import React, \{[^\}]+\} from ['"]react['"];?/g, 'const { useState, useMemo, useCallback } = React;');

// Transform Lucide imports
jsxCode = jsxCode.replace(/import \{([^\}]+)\} from ['"]lucide-react['"];?/g, (match, icons) => {
    return 'const { ' + icons + ' } = lucide;';
});

// Remove export default from main component
jsxCode = jsxCode.replace(/export default function AdvancedTestEngine/g, 'function AdvancedTestEngine');

const newHtmlCode = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Test Engine | UP Building Bylaws</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        body {
            font-family: 'Inter', sans-serif;
        }

        ::-webkit-scrollbar {
            width: 6px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: #475569;
        }
    </style>
</head>

<body class="bg-[#0f172a]">
    <div id="root"></div>

    <!-- Load Local Rule Engine Data -->
    <script src="rules-data.js"></script>
    <script src="Rule_Engine_Implementation.js"></script>

    <script type="text/babel">
        // --- INJECTED JSX CODE ---
${jsxCode}
        // --- END INJECTED JSX CODE ---

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<AdvancedTestEngine />);
    </script>
</body>

</html>`;

fs.writeFileSync(htmlPath, newHtmlCode, 'utf8');
console.log('Successfully recompiled test-advanced.html with injected JSX!');
