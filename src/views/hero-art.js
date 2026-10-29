'use strict';
/** Illustration animée du hero : un scooter dessiné en SVG (roues qui tournent, route qui défile). */
const { raw } = require('../lib/html');

const wheel = (cx, cy) => `
  <g>
    <circle cx="${cx}" cy="${cy}" r="42" fill="#0a0f15"/>
    <circle cx="${cx}" cy="${cy}" r="33" fill="#1b2634"/>
    <g class="origin-center [transform-box:fill-box] motion-safe:animate-wheel">
      <circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="#a3b1c0" stroke-width="3"/>
      <path d="M${cx} ${cy - 27}V${cy + 27}M${cx - 27} ${cy}H${cx + 27}M${cx - 19} ${cy - 19}L${cx + 19} ${cy + 19}M${cx + 19} ${cy - 19}L${cx - 19} ${cy + 19}" stroke="#a3b1c0" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#f5c518"/>
  </g>`;

const heroArt = raw(`
<svg class="w-full max-w-lg" viewBox="10 60 450 245" role="img" aria-label="Illustration d'un scooter en mouvement" focusable="false">
  <!-- lignes de vitesse -->
  <g stroke="#f5c518" stroke-width="5" stroke-linecap="round">
    <path class="motion-safe:animate-speed" d="M60 120h60" opacity=".7"/>
    <path class="motion-safe:animate-speed [animation-delay:.45s]" d="M20 160h80" opacity=".5"/>
    <path class="motion-safe:animate-speed [animation-delay:.9s]" d="M70 200h50" opacity=".6"/>
  </g>
  <!-- scooter -->
  <g class="origin-center motion-safe:animate-ride">
    ${wheel(140, 236)}
    ${wheel(410, 236)}
    <!-- carrosserie arrière -->
    <path d="M78 214C78 168 112 140 160 138H262C277 138 287 147 291 160L305 208H236L196 208A56 56 0 0 0 84 208Z" fill="#f5c518"/>
    <path d="M84 208A56 56 0 0 1 196 208" fill="none" stroke="#0a0f15" stroke-width="5" opacity=".35"/>
    <!-- selle -->
    <path d="M118 136C116 118 130 108 154 108H250C270 108 274 124 262 134L132 142Z" fill="#1b2634"/>
    <!-- plancher -->
    <rect x="190" y="204" width="170" height="22" rx="9" fill="#1b2634"/>
    <!-- bouclier avant -->
    <path d="M318 214C330 172 340 132 356 96L388 106C382 144 384 188 402 222L350 226Z" fill="#f5c518"/>
    <path d="M356 96L388 106" stroke="#0a0f15" stroke-width="5" opacity=".25"/>
    <!-- fourche et roue avant -->
    <path d="M384 104L412 236" stroke="#1b2634" stroke-width="10" stroke-linecap="round"/>
    <!-- guidon -->
    <path d="M346 88L392 76" stroke="#1b2634" stroke-width="10" stroke-linecap="round"/>
    <path d="M392 76L404 72" stroke="#0a0f15" stroke-width="12" stroke-linecap="round"/>
    <!-- phare et feu arrière -->
    <rect x="384" y="118" width="26" height="22" rx="8" fill="#fff4c2"/>
    <rect x="72" y="172" width="12" height="20" rx="4" fill="#e5483b"/>
    <!-- pot d'échappement -->
    <rect x="100" y="240" width="86" height="12" rx="6" fill="#425468" opacity=".0"/>
  </g>
  <!-- route -->
  <rect x="0" y="282" width="540" height="6" rx="3" fill="#1b2634"/>
</svg>`);

module.exports = { heroArt };
