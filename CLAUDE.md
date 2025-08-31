# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JS13K game development template using TypeScript, optimized for the 13KB size limit constraint of JS13K competitions. The project includes sophisticated build tooling that minifies, compresses, and packages everything into a single zip file.

## Development Commands

- `npm install` - Install dependencies
- `npm run serve` - Start development server (runs TypeScript compiler in watch mode and Vite dev server in parallel)
- `npm run lint` - Run ESLint on TypeScript files
- `npm run build` - Production build (minifies HTML/CSS, runs Terser, applies RoadRoller compression)
- `npm run find-best-roadroller` - Interactive tool to find optimal RoadRoller compression settings
- `npm run build-with-best-roadroller` - Build using saved RoadRoller configuration

## Build Architecture

The build system is designed for extreme size optimization:

1. **Vite Configuration** (`vite.config.ts`): Uses TypeScript plugin and custom plugins for size optimization
2. **Production Build Process**:
   - HTML is minified and CSS is inlined
   - JavaScript is minified with Terser using aggressive settings
   - Everything is embedded into a single HTML file with `document.write()`
   - RoadRoller compression is applied to the final JavaScript
   - ECT (Efficient-Compression-Tool) creates the final zip file

## Key Files

- `src/index.ts` - Main entry point (currently minimal)
- `vite.config.ts` - Build configuration with custom RoadRoller and ECT plugins
- `terser.config.ts` - Aggressive Terser minification settings optimized for size
- `find-best-roadroller.js` - Tool to optimize RoadRoller compression parameters
- `index.html` - Simple HTML shell with canvas element
- `style.css` - Minimal CSS for centering canvas on black background

## Size Optimization Strategy

The template uses a multi-stage compression approach:
1. TypeScript compilation to ES2022
2. Terser minification with aggressive settings (5 passes, unsafe optimizations enabled)
3. HTML/CSS inlining and minification
4. RoadRoller compression (JavaScript packer)
5. Final zip compression with ECT

## Development Notes

- Canvas element is set to 1920x1080 resolution
- Uses `@/` path alias pointing to `src/`
- TypeScript configured with strict mode and ES2022 target
- ESLint configured with TypeScript support and unused imports plugin
- Build output goes to `dist/` directory with final `index.zip`
- We are using websocket implementation described here - https://js13kgames.com/online