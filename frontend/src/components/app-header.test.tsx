import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/app-header";

const navigationState = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({
    push: navigationState.push,
    prefetch: navigationState.prefetch,
  }),
}));

vi.mock("@/components/settings-dialog", () => ({
  SettingsDialog: () => <button aria-label="Open settings">settings</button>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button aria-label="Toggle theme">theme</button>,
}));

describe("AppHeader navigation", () => {
  beforeEach(() => {
    navigationState.pathname = "/";
    navigationState.push.mockReset();
    navigationState.prefetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("cancels pending workspace navigation when user clicks back to current view", () => {
    render(<AppHeader />);

    const workspaceButton = screen.getAllByRole("button", {
      name: "Workspace",
    })[0];
    const extractButton = screen.getAllByRole("button", { name: "Extract" })[0];

    fireEvent.click(workspaceButton);
    fireEvent.click(extractButton);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(navigationState.push).not.toHaveBeenCalled();
  });

  it("navigates to workspace when switch is not cancelled", () => {
    render(<AppHeader />);

    const workspaceButton = screen.getAllByRole("button", {
      name: "Workspace",
    })[0];

    fireEvent.click(workspaceButton);

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(navigationState.push).toHaveBeenCalledWith("/workspace");
  });
});
