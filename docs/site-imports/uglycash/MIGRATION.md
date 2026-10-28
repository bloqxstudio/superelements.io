# UGLYCASH homepage model

Source: https://ugly.cash/
Target: `/uglycash-modelo` in the existing Vite + React application.

## Status

- `survey`: done
- `design-system`: done
- `homepage`: implementation and browser verification complete
- `style-guide`: implemented
- `Elementor template`: implemented and rebuilt with native containers/widgets; renderer reports zero unsupported widgets and zero warnings

The previously created Menuzito model remains available at `/menuzito-modelo` and `/menuzito-style-guide`.

The UGLYCASH template does not wrap sections in monolithic HTML widgets. Its eight sections use native Elementor containers, headings, text editors, images and a hosted-video widget so content remains editable in the Navigator.

## Survey

- Framer single-page site with five source breakpoints: 500, 810, 1200 and 1440 px ranges plus pointer-specific behavior.
- Canvas `#F2F2F2`, black editorial typography and white rounded section surfaces.
- Display type is Helvetica Now Display Condensed Bold at 164/140 px on the desktop hero; Inter supports body and interface text.
- Desktop content canvas is 1440 px. The surveyed page is approximately 7,693 px high at 1920 × 855.
- Main regions: fixed pill navigation; phone/video hero; three opportunity pillars; four product capability cards; regulatory clarity; usage proof; editorial videos; related products; worldwide distribution; legal footer.

## Assets

The source-derived image, SVG, font and video assets are stored under `public/uglycash/assets`. The implementation does not hotlink the source website at runtime.

## Scope boundaries

- Static marketing model only.
- No real financial account, trading, payment, custody or authentication behavior.
- Store badges, social links and regulatory cards remain presentational.
- Source analytics and tracking were not copied.
