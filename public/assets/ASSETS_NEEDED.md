# Art Assets Needed

This document lists all art assets needed for the Secret Card Game with dimensions and descriptions.

## Directory Structure
```
public/assets/
├── cards/          # Policy and role cards
├── roles/          # Role reveal artwork
├── icons/          # Executive powers, UI icons
├── ui/             # Buttons, badges, frames
└── backgrounds/    # Background textures
```

---

## 1. POLICY CARDS (`/assets/cards/`)

### Liberal Policy Card
- **File:** `liberal-policy.png`
- **Dimensions:** 300x440px (2.2:3 ratio)
- **Description:** Blue-themed policy card with dove/olive branch or peace symbol
- **Style:** 1940s propaganda poster aesthetic, aged paper texture
- **Used in:** Legislative phase card selection, policy result display

### Fascist Policy Card
- **File:** `fascist-policy.png`
- **Dimensions:** 300x440px (2.2:3 ratio)
- **Description:** Red/black themed policy card with skull or iron cross motif
- **Style:** 1940s propaganda poster aesthetic, aged paper texture
- **Used in:** Legislative phase card selection, policy result display

### Card Back
- **File:** `card-back.png`
- **Dimensions:** 300x440px (2.2:3 ratio)
- **Description:** Generic card back with period-appropriate pattern
- **Style:** Dark with gold accents, iron cross or eagle watermark
- **Used in:** Deck display, face-down cards

---

## 2. ROLE CARDS (`/assets/roles/`)

### Liberal Role Card
- **File:** `role-liberal.png`
- **Dimensions:** 280x380px
- **Description:** Liberal party membership card
- **Elements:** Blue background, dove symbol, "LIBERAL" text
- **Used in:** Role reveal phase, game over reveal

### Fascist Role Card
- **File:** `role-fascist.png`
- **Dimensions:** 280x380px
- **Description:** Fascist party membership card
- **Elements:** Red/black background, skull symbol, "FASCIST" text
- **Used in:** Role reveal phase, game over reveal

### Hitler Role Card
- **File:** `role-hitler.png`
- **Dimensions:** 280x380px
- **Description:** Secret Hitler identity card
- **Elements:** Red/gold background, distinctive symbol, "SECRET HITLER" text
- **Used in:** Role reveal phase, game over reveal

### Role Card Back
- **File:** `role-back.png`
- **Dimensions:** 280x380px
- **Description:** Face-down role card (mystery)
- **Elements:** Question mark, dark pattern
- **Used in:** Pre-reveal state

---

## 3. EXECUTIVE POWER ICONS (`/assets/icons/`)

### Investigate Loyalty
- **File:** `icon-investigate.png`
- **Dimensions:** 64x64px (also @2x: 128x128px)
- **Description:** Magnifying glass or eye symbol
- **Color:** Gold/brass on transparent
- **Used in:** Executive action phase, fascist track indicator

### Policy Peek / Examine
- **File:** `icon-examine.png`
- **Dimensions:** 64x64px (also @2x: 128x128px)
- **Description:** Three stacked cards or eye over cards
- **Color:** Gold/brass on transparent
- **Used in:** Executive action phase, fascist track indicator

### Special Election
- **File:** `icon-special-election.png`
- **Dimensions:** 64x64px (also @2x: 128x128px)
- **Description:** Ballot box or raised hand
- **Color:** Gold/brass on transparent
- **Used in:** Executive action phase, fascist track indicator

### Execution
- **File:** `icon-execute.png`
- **Dimensions:** 64x64px (also @2x: 128x128px)
- **Description:** Skull, crosshairs, or gunshot symbol
- **Color:** Red/gold on transparent
- **Used in:** Executive action phase, fascist track indicator

### Veto Power
- **File:** `icon-veto.png`
- **Dimensions:** 64x64px (also @2x: 128x128px)
- **Description:** X mark or crossed-out document
- **Color:** Red on transparent
- **Used in:** Veto action (if implemented)

---

## 4. VOTE TOKENS (`/assets/icons/`)

### Ja! (Yes) Vote
- **File:** `vote-ja.png`
- **Dimensions:** 80x80px
- **Description:** "JA!" text in period-appropriate typography
- **Style:** Blue background, white/cream text, circular or rectangular
- **Used in:** Vote result display

### Nein! (No) Vote
- **File:** `vote-nein.png`
- **Dimensions:** 80x80px
- **Description:** "NEIN!" text in period-appropriate typography
- **Style:** Red background, white/cream text, circular or rectangular
- **Used in:** Vote result display

---

## 5. GOVERNMENT BADGES (`/assets/ui/`)

### President Badge
- **File:** `badge-president.png`
- **Dimensions:** 120x40px
- **Description:** "PRESIDENT" or "PRÄSIDENT" badge
- **Style:** Gold with black text, ornate border
- **Used in:** Player cards, info bar

### Chancellor Badge
- **File:** `badge-chancellor.png`
- **Dimensions:** 120x40px
- **Description:** "CHANCELLOR" or "KANZLER" badge
- **Style:** Silver/brass with dark text, ornate border
- **Used in:** Player cards, info bar

### Previous Government Badge
- **File:** `badge-term-limited.png`
- **Dimensions:** 100x30px
- **Description:** "TERM LIMITED" indicator
- **Style:** Muted gray, subtle
- **Used in:** Player selection phase

---

## 6. UI ELEMENTS (`/assets/ui/`)

### Game Logo
- **File:** `logo.png`
- **Dimensions:** 400x150px
- **Description:** "SECRET CARD GAME" in 1940s typography
- **Style:** Gold text, dark background, period-appropriate flourishes
- **Used in:** Title screen, lobby

### Policy Slot (Empty)
- **File:** `slot-empty.png`
- **Dimensions:** 60x90px
- **Description:** Empty slot for policy track
- **Style:** Dark recessed area with subtle border
- **Used in:** Policy tracks on game board

### Liberal Policy Slot (Filled)
- **File:** `slot-liberal.png`
- **Dimensions:** 60x90px
- **Description:** Filled liberal policy slot
- **Style:** Blue glowing slot
- **Used in:** Liberal policy track

### Fascist Policy Slot (Filled)
- **File:** `slot-fascist.png`
- **Dimensions:** 60x90px
- **Description:** Filled fascist policy slot
- **Style:** Red glowing slot
- **Used in:** Fascist policy track

### Election Tracker Marker
- **File:** `tracker-marker.png`
- **Dimensions:** 30x30px
- **Description:** Marker for election tracker position
- **Style:** Gold/brass circular marker
- **Used in:** Election tracker display

### Player Frame
- **File:** `player-frame.png`
- **Dimensions:** 200x100px
- **Description:** Decorative frame for player cards
- **Style:** Ornate 1940s border, brass/gold accents
- **Used in:** Player selection grid

### Dead Player Overlay
- **File:** `overlay-dead.png`
- **Dimensions:** 200x200px
- **Description:** Semi-transparent "EXECUTED" stamp or X
- **Style:** Red stamp effect, tilted
- **Used in:** Executed player cards

---

## 7. BACKGROUNDS (`/assets/backgrounds/`)

### Aged Paper Texture
- **File:** `texture-paper.png`
- **Dimensions:** 512x512px (tileable)
- **Description:** Yellowed, aged paper texture
- **Used in:** Card backgrounds, UI panels

### Leather Texture
- **File:** `texture-leather.png`
- **Dimensions:** 512x512px (tileable)
- **Description:** Dark leather texture for table/board
- **Used in:** Game board background

### Wood Grain Texture
- **File:** `texture-wood.png`
- **Dimensions:** 512x512px (tileable)
- **Description:** Dark polished wood grain
- **Used in:** Alternative board background

---

## 8. DECORATIVE ELEMENTS (`/assets/backgrounds/`)

### Eagle Emblem
- **File:** `emblem-eagle.png`
- **Dimensions:** 200x200px
- **Description:** Period-appropriate eagle emblem (stylized, not Nazi)
- **Style:** Gold/brass, semi-transparent
- **Used in:** Background watermarks, UI accents

### Iron Cross
- **File:** `emblem-cross.png`
- **Dimensions:** 100x100px
- **Description:** Iron cross symbol
- **Style:** Gold outline, transparent fill
- **Used in:** Background watermarks, decorative elements

### Laurel Wreath
- **File:** `emblem-laurel.png`
- **Dimensions:** 150x150px
- **Description:** Victory laurel wreath
- **Style:** Gold, can frame other elements
- **Used in:** Winner display, badges

---

## Implementation Priority

### HIGH PRIORITY (Core Gameplay)
1. `liberal-policy.png` - Essential for card selection
2. `fascist-policy.png` - Essential for card selection
3. `card-back.png` - Deck display
4. `role-liberal.png` - Role reveal
5. `role-fascist.png` - Role reveal
6. `role-hitler.png` - Role reveal
7. `vote-ja.png` - Voting display
8. `vote-nein.png` - Voting display

### MEDIUM PRIORITY (Polish)
9. `badge-president.png` - Government indicators
10. `badge-chancellor.png` - Government indicators
11. `icon-investigate.png` - Executive powers
12. `icon-examine.png` - Executive powers
13. `icon-special-election.png` - Executive powers
14. `icon-execute.png` - Executive powers
15. `logo.png` - Branding

### LOW PRIORITY (Enhancement)
16. `texture-paper.png` - Visual polish
17. `texture-leather.png` - Visual polish
18. `emblem-eagle.png` - Atmosphere
19. `emblem-cross.png` - Atmosphere
20. All slot images - Can remain CSS-only

---

## Style Guidelines

### Color Palette
- **Liberal Blue:** #1e3a5f, #2d4a6f
- **Fascist Red:** #8b0000, #a31621
- **Gold/Brass:** #c9a227, #d4af37, #b5a642
- **Cream/Paper:** #d4c5a9, #f5e6c8
- **Dark/Black:** #1a1a1a, #2d2d2d

### Typography Style
- 1940s propaganda poster fonts
- Bold, condensed sans-serifs
- Gothic/Blackletter for titles
- Typewriter fonts for documents

### Visual Style
- Aged, weathered textures
- High contrast
- Dramatic shadows
- Period-appropriate imagery (avoid explicit Nazi symbols)
- Propaganda poster aesthetic

---

## File Formats
- **PNG** for transparency support (cards, icons, badges)
- **JPG** for backgrounds/textures (smaller file size)
- **SVG** for icons where possible (scalability)

## Naming Convention
- Lowercase with hyphens: `liberal-policy.png`
- Include @2x variants for retina: `icon-execute@2x.png`
