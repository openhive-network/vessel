import { describe, it, expect } from 'vitest';
import { pathToFileURL } from 'url';
import * as path from 'path';
import { isAllowedNavigation } from '../navigation';

const rendererEntry = pathToFileURL(path.resolve('/opt/Vessel/resources/app/out/renderer/index.html')).href;
const production = { rendererEntry };

describe('isAllowedNavigation — production', () => {
  it('allows the renderer entry itself, with the sign-window query and a router fragment', () => {
    expect(isAllowedNavigation(rendererEntry, production)).toBe(true);
    expect(isAllowedNavigation(`${rendererEntry}?type=sign&action=promptOperation&ops=e30%3D`, production)).toBe(true);
    expect(isAllowedNavigation(`${rendererEntry}#/send`, production)).toBe(true);
  });

  it.each([
    'http://localhost.evil.example/',
    'http://localhost:9999/',
    'http://localhost/',
    'https://example.com/',
    'file:///etc/passwd',
    `${rendererEntry.replace('index.html', 'other.html')}`,
    'javascript:alert(1)',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAllowedNavigation(url, production)).toBe(false);
  });
});

describe('isAllowedNavigation — electron-vite dev (ELECTRON_RENDERER_URL set)', () => {
  const dev = { rendererEntry, devServerUrl: 'http://localhost:5173' };

  it('allows the dev server origin', () => {
    expect(isAllowedNavigation('http://localhost:5173/', dev)).toBe(true);
    expect(isAllowedNavigation('http://localhost:5173/?type=sign#/x', dev)).toBe(true);
  });

  it('rejects other localhost ports, look-alike hosts and files', () => {
    expect(isAllowedNavigation('http://localhost:9999/', dev)).toBe(false);
    expect(isAllowedNavigation('http://localhost.evil.example:5173/', dev)).toBe(false);
    expect(isAllowedNavigation('file:///etc/passwd', dev)).toBe(false);
  });
});
