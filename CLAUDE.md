# Baseline Marketing Site
Plain HTML/CSS/JS. No build steps or frameworks.

## Development
- **Run:** `python3 -m http.server 4173`
- **Figma:** `https://www.figma.com/design/JwibWVcsq7D2s17AmdcPR1/Website-Demo` (Hero node `59:4885`).

## Conventions
- **Colors:** Monochrome. Status badges: `#ef4444` (critical), `#00a56f` (healthy).
- **Fonts:** Geist Mono, Geist, Inter, Space Grotesk. CSS variables on `:root` in `index.html`.
- **Assets:** Exported Figma assets only.
- **Responsive:** Phone width support (16px gutter, no horizontal scroll).
- **Motion:** Refer to `motion-guide.md` ONLY for animations. Update it in the same task if changed.

## Architecture
- `index.html`: Markup + `<style>`.
- `motion.css` / `motion.js`: Motion configs and behaviors.
- `assets/`: Exported sections.