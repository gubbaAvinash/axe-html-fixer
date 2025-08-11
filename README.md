# Axe HTML Fixer

This Node.js script reads an HTML file and an Axe accessibility JSON report, then applies basic fixes to the HTML.

## How to Use

1. Install dependencies:

```bash
npm install
```

2. Run the script:

```bash
node fixAccessibility.js path/to/Dashboard.html path/to/DashboardAxe.json
```

3. The fixed HTML will be saved in the same folder as `*_fixed.html`.
4. Any elements not found in the HTML will be printed as JSON in the terminal.

## Notes

- Preserves custom tags like `<wm-button>`.
- Currently supports:
  - `button-name`: Adds `aria-label` if missing.
  - `link-in-text-block`: Adds underline styling.
  - `meta-viewport`: Removes `user-scalable=no`.
