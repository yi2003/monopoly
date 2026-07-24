# 🏠 家庭大富翁 (Family Monopoly 3D)

A 3D Monopoly-style board game built with React, Three.js, and Socket.IO. Supports multiplayer with bots, multiple themes, a dynamic economy, and immersive 3D city scenes.

## ✨ Features

- **3D Board & City** — Procedurally generated buildings, ring roads with vehicles, pedestrians on sidewalks, day/night cycle, and weather effects
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
│       ├── scene/      # 3D rendering (Board, CityBuilder, Characters, Vehicles, Pedestrians)
│       ├── camera/     # Camera controller & free-roam
│       ├── roam/       # First-person walking mode
│       ├── store/      # Zustand state (gameStore, uiStore)
│       ├── network/    # Socket.IO client
│       ├── audio/      # Audio manager
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
- **Vehicles** (cars, buses, trucks, bicycles) drive on the ring road
- **Pedestrians** walk on sidewalks between tiles and buildings

### Turn Flow

1. **Roll dice** — Move clockwise on your current ring
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
| 3D Rendering | Three.js |
| Frontend | React 18 + TypeScript |
| State | Zustand |
| Networking | Socket.IO |
| Build | Vite |
| Server | Node.js + Express |
| Monorepo | npm workspaces |

## 📝 License

Private project — all rights reserved.
