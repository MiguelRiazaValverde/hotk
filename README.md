# @hotk/hotk

[![npm version](https://img.shields.io/npm/v/@hotk/core.svg)](https://www.npmjs.com/package/@hotk/core)

> **hotk** is a lightweight and ergonomic library for managing advanced hotkeys on desktop platforms. It provides a declarative and expressive API to register key combinations, define actions, chain subactions, and detect patterns like double presses or complex sequences.

| Platform | Supported | Tested |
| -------- | :-------: | :----: |
| Windows  |    ✅     |   ✅   |
| macOS    |    ❓     |   ❌   |
| Linux    |    ❓     |   ❌   |

## Install

```bash
npm install @hotk/hotk
```

## Basic usage

```js
import { hotKey, KeyCodes, Mods, Stroke } from "@hotk/hotk";

hotKey([Mods.Control], KeyCodes.KeyA)
  .action(() => console.log("ctrl a"))
  .stroke(Stroke.Double)
  .subaction(
    hotKey([], KeyCodes.KeyB)
      .action(() => console.log("b"))
      .subaction(hotKey([], KeyCode.KeyZ).action(() => console.log("z")))
  )
  .subactionsTimeout(1000)
  .register();

hotKey([], KeyCodes.Escape)
  .action(() => console.log("escape"))
  .stroke(Stroke.Double)
  .global(true)
  .register();
```
