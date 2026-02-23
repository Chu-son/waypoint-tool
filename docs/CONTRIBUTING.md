# Contributing to Waypoint Tool

Thank you for your interest in contributing to the Waypoint Tool! This document provides guidelines and instructions for developers who want to contribute to the project.

## Development Environment Setup

1. **Prerequisites**
   - Node.js (v18 or newer)
   - Rust (latest stable)
   - Tauri dependencies (see Tauri documentation for your OS)

2. **Installation**
   ```bash
   npm install
   ```

3. **Running the Application**
   ```bash
   npm run tauri dev
   ```

## Project Structure

- `src/`: React frontend code (TypeScript, Vite, Tailwind CSS, Zustand, PixiJS)
- `src-tauri/src/`: Rust backend code (Tauri commands, File I/O, Plugin execution)
- `docs/`: Project documentation
- `python_sdk/`: Python SDK for writing generator plugins
- `rust_wasm_sdk/`: (Draft/Future) Rust SDK for WebAssembly plugins

## Testing

Before submitting a pull request, please ensure all tests pass:

```bash
# Run frontend and backend tests
npm run test
```

We use `vitest` with `@testing-library/react` for the frontend and standard `cargo test` for the backend. Please add relevant tests when submitting new features or bug fixes.

## Plugin Development

If you're interested in creating new waypoint generation algorithms, consider writing a plugin rather than modifying the core application. 
Check `docs/DEVELOPER_GUIDE.md` and the `python_sdk/` directory for examples.

## Submitting Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AddSomeFeature`)
3. Commit your changes following the [Naming Conventions](docs/NAMING_CONVENTIONS.md)
4. Push to the branch (`git push origin feature/AddSomeFeature`)
5. Open a Pull Request
