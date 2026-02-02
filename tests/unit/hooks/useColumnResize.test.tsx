import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useColumnResize, getMinColumnWidth, type ColumnWidths } from "@/hooks/useColumnResize";

const createPointerEvent = (type: string, clientX: number) => {
  const event = new Event(type) as PointerEvent;
  Object.defineProperty(event, "clientX", {
    value: clientX,
    configurable: true,
  });
  return event;
};

describe("useColumnResize", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates column widths when pointer moves", () => {
    const onWidthsChange = vi.fn();
    const initialWidths: ColumnWidths = { date: 180, statut: 140 };

    const { result } = renderHook(() => useColumnResize(initialWidths, onWidthsChange));

    const event = {
      preventDefault: vi.fn(),
      clientX: 120,
    };

    act(() => {
      result.current.handlePointerDown(event as any, "date");
    });

    // Vérifie que la colonne active est définie
    expect(result.current.activeColumn).toBe("date");

    act(() => {
      document.dispatchEvent(createPointerEvent("pointermove", 220));
    });

    // delta = 220 - 120 = 100, newWidth = 180 + 100 = 280
    expect(onWidthsChange).toHaveBeenLastCalledWith({
      date: 280,
      statut: 140,
    });

    act(() => {
      document.dispatchEvent(createPointerEvent("pointerup", 220));
    });

    // Après pointerup, la colonne active est réinitialisée
    expect(result.current.activeColumn).toBeNull();

    // Les pointermove suivants ne doivent pas déclencher de mise à jour
    const callCount = onWidthsChange.mock.calls.length;
    act(() => {
      document.dispatchEvent(createPointerEvent("pointermove", 260));
    });
    expect(onWidthsChange).toHaveBeenCalledTimes(callCount);
  });

  it("clamps width to the minimum value", () => {
    const onWidthsChange = vi.fn();
    // La colonne "date" a une largeur min de 85 (voir MIN_COLUMN_WIDTHS)
    const initialWidths: ColumnWidths = { date: 150 };

    const { result } = renderHook(() => useColumnResize(initialWidths, onWidthsChange));

    const event = {
      preventDefault: vi.fn(),
      clientX: 200,
    };

    act(() => {
      result.current.handlePointerDown(event as any, "date");
    });

    // Déplacer vers la gauche pour réduire la largeur en dessous du min
    // delta = 50 - 200 = -150, newWidth = max(85, 150 - 150) = 85
    act(() => {
      document.dispatchEvent(createPointerEvent("pointermove", 50));
    });

    const minWidth = getMinColumnWidth("date");
    expect(onWidthsChange).toHaveBeenLastCalledWith({
      date: minWidth, // 85
    });
  });

  it("allows width to increase without upper limit in implementation", () => {
    const onWidthsChange = vi.fn();
    const initialWidths: ColumnWidths = { date: 400 };

    const { result } = renderHook(() => useColumnResize(initialWidths, onWidthsChange));

    const event = {
      preventDefault: vi.fn(),
      clientX: 100,
    };

    act(() => {
      result.current.handlePointerDown(event as any, "date");
    });

    // L'implémentation actuelle n'a pas de largeur max
    // delta = 1200 - 100 = 1100, newWidth = 400 + 1100 = 1500
    act(() => {
      document.dispatchEvent(createPointerEvent("pointermove", 1200));
    });

    expect(onWidthsChange).toHaveBeenLastCalledWith({
      date: 1500,
    });
  });
});
