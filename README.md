# 🏠 家庭大富翁 (Family Monopoly 3D)

A 3D Monopoly-style board game built with React, Three.js, and Socket.IO. Supports multiplayer with bots, multiple themes, a **time-travel era system** that transforms the entire city, and immersive 3D scenes.

## 🕰️ Era System — Time Travel Through 4 Eras

The entire city transforms when you switch eras — buildings, vehicles, pedestrians, lighting, weather, and even the board surface change.

| Era | Theme | Building Style | Vehicles | Atmosphere |
|-----|-------|---------------|----------|------------|
| **1945** POSTWAR | Brick, soot & neon first light | Low-rise brick/stone, fire escapes, water towers, soot-stained facades | Vintage sedans, trucks, tram rails | Desaturated warm film grade, thick brown smog, worn cracked tiles |
| **1985** NEON DECADE | Chrome, synth & midnight magenta | Mixed brick/glass mid-rises, neon strip accents | Boxy 80s sedans, muscle cars, taxi cabs | Oversaturated cool film grade, cracked asphalt, neon glow signs |
| **2025** NOW | E-bikes, glass, green roofs | Tall glass towers, green roofs, LED lighting | Modern EVs, SUVs, scooters, delivery vans | Neutral clean look, fresh pavers, moderate clarity |
| **2055** HORIZON | Biolume, pods & living glass | Floating crystal towers with hover glow discs, biolume facades | Flying drone taxis, autonomous pods, maglev, glowing cycles | Biolume teal atmosphere, smart pavement, cleanest air |

### Era-specific details

- **Board surface**: 1945 cracked stained concrete → 2055 living smart-grid tiles with biolume specks
- **Center landmark**: 1945 stone clock tower → 1985 neon tower → 2025 glass/steel tower → 2055 floating crystal spire
- **Tokyo Tower**: 1945-2025 red/white lattice tower with X-bracing → 2055 floating biolume crystal pagoda
- **Pedestrians**: 1945 hats & overcoats → 1985 punk & aerobics → 2055 all with chest glow strips, visors, drone companions
- **Weather**: Rain (5000 particles with wind drift), snow (2500 with sway), storm (lightning flashes, sky darkening), fog
- **Film post-processing**: Era-specific color grading (contrast, saturation, warmth, vignette, subtle film grain)
- **Audio**: Footsteps, car horns, bicycle bells, thunder, birds, street vendors, rain/wind ambience

## ✨ Features

- **🕰️ 4 Eras** — Time-travel system transforms buildings, vehicles, pedestrians, board, and atmosphere
- **3D Board & City** — Procedurally generated buildings with era-specific facade textures, ring roads with vehicles, pedestrians on sidewalks, day/night cycle, and weather effects
- **Multiplayer** — Real-time gameplay via WebSocket with room-based matchmaking
- **Bot Players** — AI opponents with configurable difficulty
- **Dual Ring Board** — Inner ring + outer ring (96 ground tiles) + inner city (24 tiles), with property trading, houses, and hotels
- **Stock Market** — Buy/sell stocks with dynamic pricing (TECH, GOLD, AI, BANK, GREEN)
- **Quiz System** — Knowledge questions trigger at turn start with rewards/penalties
- **Wheel of Fortune** — Spin for cash, stocks, jail escape, and more
- **Chance & Community Chest** — Card-based random events
- **Bankruptcy System** — Asset transfer to creditor on bankruptcy
- **3 Themes** — Classic (🏛️), Shanghai (🌃), Tokyo (🗼)
- **4 Difficulties** — Easy / Normal / Hard / Expert
- **Free-roam Camera** — First-person walking mode to explore the city
- **Multilingual** — Chinese / English UI
- **Event Log** — Persistent scrollable log panel with clear payer → receiver messages

## 📸 Screenshots

<!-- Add era screenshots here. Suggested: -->
<!-- 
### 1945 — POSTWAR
![1945](./screenshots/1945.png)

### 1985 — NEON DECADE  
![1985](./screenshots/1985.png)

### 2025 — NOW
![2025](./screenshots/2025.png)

### 2055 — HORIZON
![2055](./screenshots/2055.png)
-->

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server (client + server concurrently)
npm run dev

# Or start individually
npm run dev:server   # Server on :3001
npm run dev:client   # Client on :3000 (Vite HMR)
```

Open `http://localhost:3000` in your browser.

### Production Build

```bash
npm run build          # Builds shared + client
npm run typecheck      # Type-check all packages
```

## 🏗️ Project Structure

```
├── client/             # React + Three.js frontend (Vite)
│   └── src/
│       ├── components/ # UI components (Modals, HUD, Lobby, Special)
│       ├── scene/      # 3D rendering (Board, CityBuilder, Dice3D, Characters, Vehicles, Pedestrians, PostProcessing, DayNightCycle, WeatherEffects)
│       ├── textures/   # Procedural canvas textures (surfaces, signs)
│       ├── camera/     # Camera controller & free-roam
│       ├── roam/       # First-person walking mode
│       ├── store/      # Zustand state (gameStore, uiStore)
│       ├── network/    # Socket.IO client
│       ├── audio/      # Audio manager (procedural Web Audio)
│       ├── util/       # Canvas helpers, noise, geometry utils
│       ├── i18n/       # Translations (zh/en)
│       └── styles/     # CSS
├── server/             # Node.js + Socket.IO backend
│   └── src/
│       ├── GameManager.ts  # Core game logic
│       ├── RuleEngine.ts   # Move validation, rent calc
│       ├── StockMarket.ts  # Stock trading & price updates
│       ├── BotBrain.ts     # AI bot decision-making
│       └── GameRoom.ts     # Lobby & room management
├── shared/             # Shared types, constants, rules (used by both)
│   └── src/
│       ├── eras.ts         # Era definitions (palette, buildings, traffic, people per era)
│       ├── boardLayout.ts  # Tile→3D-world coordinate mapping
│       ├── constants.ts    # Property definitions, quiz Q&A
│       ├── types.ts        # TypeScript interfaces
│       ├── rules.ts        # Rent calc, building logic
│       └── themes.ts       # Theme & difficulty configs
└── 需求文档-完整版.md    # Full requirements doc (Chinese)
```

## 🎮 Gameplay

### Board Layout

```
Inner-city buildings | Inner-ring tiles → sidewalk → buildings | sidewalk |
Outer-ring tiles → sidewalk → buildings → 🛣️ Road
```

- **120 tiles total**: 48 inner ground + 48 outer ground + 24 inner city
- **Ring road** with lane markings on the outermost perimeter
- **Vehicles** (era-specific: vintage sedans → EVs → flying drone taxis) drive on the ring road
- **Pedestrians** (era-specific outfits) walk on sidewalks between tiles and buildings
- **Skyline ring** of distant buildings with era-specific silhouettes
- **Tram rails** in 1945 era

### Turn Flow

1. **Roll dice** — 3D dice animation on felt table, move clockwise on your current ring
2. **Land on tile** — Buy property, pay rent, draw card, spin wheel, or trigger quiz
3. **Quiz** (12% chance) — Answer correctly for a cash reward, or pay a penalty
4. **Build houses** — On any owned property in a completed color group
5. **Trade stocks** — Buy/sell on the market during your turn
6. **End turn** — Maintenance fee (on hard+ difficulties), next player

### Key Mechanics

| Mechanic | Details |
|----------|---------|
| Rent | Increases with houses (1-4) and hotel (5). Doubled for full group w/o houses |
| Houses | Build evenly across group. Max 5 (hotel). Sell at half price |
| Railways | Rent scales with count owned: $25 → $50 → $100 → $200 |
| Utilities | Rent = dice roll × multiplier (4× for 1, 10× for 2) |
| Tax | Fixed or percentage-based, scales with difficulty |
| Jail | 3 turns max. Pay $50, use card, or roll doubles to escape |
| Salary | $200 for passing GO |
| Bankruptcy | All assets transfer to creditor (the player owed rent) |

### Difficulty Scaling

| Setting | Easy | Normal | Hard | Expert |
|---------|------|--------|------|--------|
| Maintenance Fee | 0% | 3% | 5% | 8% |
| Rent Multiplier | 0.6× | 1.0× | 1.5× | 2.0× |
| Tax Multiplier | 0.6× | 1.0× | 1.5× | 2.0× |
| START Salary | $300 | $200 | $150 | $100 |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D Rendering | Three.js + custom GLSL shaders |
| Post-Processing | EffectComposer, UnrealBloomPass, film-grade ShaderPass |
| Frontend | React 18 + TypeScript |
| State | Zustand |
| Networking | Socket.IO |
| Build | Vite |
| Server | Node.js + Express |
| Audio | Web Audio API (procedural synthesis) |
| Textures | Canvas 2D (procedural generation) |
| Monorepo | npm workspaces |

## 📝 License

Private project — all rights reserved.
