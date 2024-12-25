// src/polyfills.ts
import process from "process"; // must install: npm install process
// Attach to window so libraries that expect process can find it
// This is a minimal approach: you can attach what your libraries need
(window as any).process = process;
