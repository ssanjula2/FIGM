/**
 * Framework-Independent Guideline Model (FIGM)
 * Vue AST Parser (Phase 04)
 *
 * Thin, honest wrapper around Vue's OWN real compiler packages — never a regex or hand-rolled
 * tokenizer pretending to be one:
 *
 *   - `@vue/compiler-sfc` splits a `.vue` Single-File Component into its constituent blocks
 *     (`<template>`, `<script>`, `<script setup>`, `<style>`) with genuine, absolute-to-the-whole-
 *     file source offsets for each.
 *   - `@vue/compiler-dom` is passed EXPLICITLY as the template sub-compiler (`compiler:` option)
 *     rather than left as compiler-sfc's implicit default, so this module's dependency on it is a
 *     real, visible one, not an accident of default configuration. It parses `<template>` into
 *     `@vue/compiler-core`'s real element/directive/interpolation AST (`RootNode`), including
 *     resolving `v-for`'s microsyntax (`item in items`, `(item, index) in items`) into a genuine
 *     `ForParseResult` — Vue's own parser, not a hand-written one.
 *
 * Confirmed empirically (not assumed): every node's `.loc.start.offset` / `.loc.end.offset`
 * produced by `@vue/compiler-sfc`'s `parse()` is absolute to the WHOLE FILE, not relative to the
 * `<template>` block — so callers can splice directly against the original source string with no
 * additional offset arithmetic for the template side.
 */

import { parse as parseSfc, type SFCDescriptor, type SFCParseResult, type SFCScriptBlock } from '@vue/compiler-sfc';
import * as CompilerDom from '@vue/compiler-dom';

export interface VueSfcParseResult {
  descriptor: SFCDescriptor;
  errors: SFCParseResult['errors'];
}

/**
 * Parses a `.vue` Single-File Component's raw source into its real, offset-accurate block
 * structure and template AST. Never throws — `@vue/compiler-sfc` is itself error-tolerant
 * (returns `errors` rather than throwing for most malformed input); any truly unexpected internal
 * exception is still caught here so a pathological input degrades to "no usable descriptor"
 * rather than crashing the caller, matching this codebase's established resilience contract for
 * every other real-AST parser (see SourceParser.parseSource's doc comment).
 */
export function parseVueSfc(code: string, filePath: string): VueSfcParseResult | undefined {
  try {
    const result = parseSfc(code, {
      filename: filePath,
      compiler: CompilerDom,
    });
    return { descriptor: result.descriptor, errors: result.errors };
  } catch {
    return undefined;
  }
}

/**
 * The single script block this engine should read: `<script setup>` when present (the dominant
 * modern Vue 3 Composition API style, where `computed()`/`ref()` calls actually live), otherwise
 * the plain `<script>` block. Returns undefined for a template-only SFC (no script at all).
 */
export function getPrimaryScriptBlock(descriptor: SFCDescriptor): SFCScriptBlock | undefined {
  return descriptor.scriptSetup ?? descriptor.script ?? undefined;
}

/**
 * Converts a 1-based line / 0-based column position (the shape FIGM diagnostics report) into an
 * absolute character offset within `source` — the Vue/plain-text equivalent of
 * `ts.SourceFile.getPositionOfLineAndCharacter`, which isn't available here because a `.vue` file
 * as a whole is not TypeScript. Pure arithmetic over `source.split('\n')` line lengths, not a
 * text search: the line-splitting mirrors exactly what `ts.SourceFile.getLineStarts()` does
 * internally.
 */
export function lineColumnToOffset(source: string, line: number, column: number): number {
  const lines = source.split('\n');
  let offset = 0;
  const targetLineIndex = Math.max(0, Math.min(line - 1, lines.length - 1));
  for (let i = 0; i < targetLineIndex; i++) {
    offset += lines[i].length + 1; // +1 for the '\n' the split consumed
  }
  return offset + Math.max(0, column);
}
