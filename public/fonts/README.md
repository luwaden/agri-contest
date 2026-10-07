# Elza (brand typeface)

The brand guide specifies **Elza** (Regular, Semibold, Bold, Extra Bold) with **Inter** as the fallback. Elza is a commercial font, so it is not bundled.
Until you add it, the site renders in Inter, which the guide approves.

To switch on Elza:
1. Convert your licensed files to `.woff2` and put them in this folder, e.g. `Elza-Regular.woff2`, `Elza-Semibold.woff2`, `Elza-Bold.woff2`, `Elza-ExtraBold.woff2`.
2. In `app/globals.css`, add the file to each `@font-face`, e.g.
   `src: url("/fonts/Elza-Bold.woff2") format("woff2"), local("Elza Bold");`

Type rules from the guide: headers Bold/Extra Bold (tracking -40 = -0.04em), sub-headers Semibold (-20), body Regular (0). Never use italics alone as a header or Inter italics for body text.
