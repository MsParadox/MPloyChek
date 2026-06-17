// MPloyChek — Theme Service Tests
// Author: Mohit Sharma
import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ThemeService] });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => localStorage.clear());

  it('should be created', () => expect(service).toBeTruthy());

  it('should default to dark theme', () => expect(service.isDark).toBeTrue());

  it('toggle() should switch from dark to light', () => {
    expect(service.isDark).toBeTrue();
    service.toggle();
    expect(service.isDark).toBeFalse();
    expect(localStorage.getItem('mploychek_theme')).toBe('light');
  });

  it('toggle() twice should return to dark', () => {
    service.toggle();
    service.toggle();
    expect(service.isDark).toBeTrue();
    expect(localStorage.getItem('mploychek_theme')).toBe('dark');
  });

  it('should persist theme to localStorage', () => {
    service.toggle();
    // New instance should pick up persisted theme
    const service2 = new ThemeService();
    expect(service2.isDark).toBeFalse();
  });
});
