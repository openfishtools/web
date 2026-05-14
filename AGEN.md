# Project Rules - CHROS (Material You)

## Project Structure
- `index.html`: Main entry point (CHROS)
- `styles/main.css`: Core design system, greentea theme, and mobile-first layout
- `styles/responsive.css`: Adaptive layouts (Rail for Tablet, Drawer for Desktop)
- `scripts/app.js`: Application logic and Google Messages style chat functionality
- `assets/`: Static assets

## Design System Rules
- Follow Android 15 Material You (MD3) design language
- Theme: **Greentea** (Green-based tonal palettes)
- Use dynamic color tokens based on HSL variables
- Implement 8dp grid system for spacing
- Rounded corners: Medium (12px), Large (16px), Extra Large (28px)
- Full-screen main content on Mobile; Floating card look on Tablet/Desktop
- Smooth transitions (250ms) using cubic-bezier(0.2, 0, 0, 1)

## Responsive Rules
- Mobile First: No header, no logo, full-screen main content
- Mobile (< 600px): Bottom navigation bar
- Tablet (600px - 1024px): Left Navigation Rail (80px width, icon-only pills)
- Desktop (> 1024px): Left Navigation Drawer (280px width, full-width pills)
- No top app bar or brand logo in the main activity

## Chat UI (Google Messages Style)
- Immersive full-screen chat with no global scrollbar
- Grouped message bubbles with asymmetric corner rounding
- MD3 chat header with avatar and status
- Pill-shaped input area with attachment/emoji icons and separate send FAB
- Real-time timestamps in message groups

## Coding Rules
- Use semantic HTML5 elements
- Never place CSS or JavaScript inline in HTML
- Never combine CSS and JS into one file
- Do not add comments inside any code files
- Preserve responsiveness and "greentea" theme consistency
- Maintain "CHROS" branding throughout the project

## AI Agent Guidelines (Critical)
- **Proactive Logic Audits**: Always analyze the underlying logic before implementing changes. If a flaw or edge case is found, fix it proactively.
- **Robustness First**: Ensure every new feature has proper error handling and doesn't conflict with existing features.
- **Cross-File Integrity**: When modifying HTML, immediately verify if the corresponding CSS and JS need updates to maintain visual and functional consistency.
- **Bug Prevention**: Prioritize fixing potential bugs over simply following instructions. If a requested change would break the project, suggest a safer alternative or fix the dependency first.
- **Strict Adherence**: Never destroy the core logic or the "Material You" design system while optimizing.
- **Syntax Vigilance**: Always verify syntax and structure before saving files.
- **Zero-Inline Purity**: Absolutely no inline CSS (`style="..."`) or inline JS (event handlers) allowed in HTML files. All logic and styling must be in their respective files.
- **Proactive CSS Cleanup**: When a feature or element is removed or updated, proactively identify and delete any unused CSS classes to keep the stylesheet lean.
