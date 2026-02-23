# ROS Waypoint Tool

A standalone desktop application for creating, editing, and managing Waypoints for autonomous mobile robots using ROS/ROS2 Navigation.
Built with Tauri (Rust) + React + Vite + Tailwind CSS + PixiJS.

## Documentation

Please refer to the following documents for comprehensive guides:
- [Requirements (システム要件定義)](./docs/REQUIREMENTS.md)
- [Naming Conventions (命名規則)](./docs/NAMING_CONVENTIONS.md)
- [User Manual (ユーザーの使い方)](./docs/USER_MANUAL.md)
- [Developer Guide (開発者向け機能追加方法)](./docs/DEVELOPER_GUIDE.md)

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- Tauri dependencies (`sudo apt update && sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` on Ubuntu)

### Running Locally
```bash
# Install frontend dependencies
npm install

# Run the Tauri development app
npm run tauri dev
```
