# The share image

`public/og.png` is a screenshot of `/og`, a page that lays the hero out at exactly 1200×630 and paints it dark with the
theme's own tokens inline (so the box is dark even on a light page, and a pixel search for the dark rectangle finds it).

To regenerate after a hero or headline change:

1. Run the dev server and open `http://localhost:3010/og` in a browser at 2× device pixel ratio.
2. Screenshot the `#og` box (a region capture of its bounding rect) and save it.
3. Crop to the dark rectangle and resize to 1200×630 with a Lanczos filter, then write `public/og.png`.
4. Check `<meta property="og:image">` on production points at `/og.png` and that the file is under 300 KB.

The metadata lives in `src/app/layout.tsx` (`openGraph.images`, `twitter.images`). The page is `robots: noindex`.
