/// <reference types="jest" />

import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import {
  getActiveTabIndex,
  getAvailableTabBarWidth,
  getIndicatorMetrics,
  shouldAnimateTabIndicator,
  WalletTabBar,
} from "./wallet-tab-bar";

const mockWithTiming = jest.fn((value: number) => value);
let mockReducedMotion = false;

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const { View: NativeView } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View: NativeView },
    Easing: { cubic: "cubic", out: (easing: unknown) => easing },
    useAnimatedStyle: (updater: () => object) => updater(),
    useSharedValue: (initialValue: number) => React.useRef({ value: initialValue }).current,
    withTiming: (...args: Parameters<typeof mockWithTiming>) => mockWithTiming(...args),
  };
});

jest.mock("lucide-react-native", () => {
  const React = jest.requireActual("react");
  const { View: NativeView } = jest.requireActual("react-native");
  const Icon = (props: Record<string, unknown>) => React.createElement(NativeView, props);
  return {
    BarChart3: Icon,
    LayoutDashboard: Icon,
    PiggyBank: Icon,
    ReceiptText: Icon,
    WalletCards: Icon,
  };
});

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/components/quick-add-menu", () => ({ AddFab: () => null }));
jest.mock("@/components/motion", () => {
  const actual = jest.requireActual("@/components/motion");
  return { ...actual, useReduceMotion: () => mockReducedMotion };
});

const VISIBLE_ROUTES = ["(dashboard)", "(transactions)", "(plans)", "(statistics)", "(accounts)"];

function createProps(activeIndex: number): BottomTabBarProps {
  const routes = VISIBLE_ROUTES.map((name) => ({
    key: `${name}-key`,
    name,
    params: undefined,
  }));

  return {
    state: {
      key: "tabs",
      index: activeIndex,
      routeNames: VISIBLE_ROUTES,
      routes,
      history: [],
      type: "tab",
      stale: false,
    },
    descriptors: Object.fromEntries(routes.map((route) => [route.key, { options: {} }])),
    navigation: {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
      dispatch: jest.fn(),
    },
  } as unknown as BottomTabBarProps;
}

describe("wallet tab indicator", () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockWithTiming.mockClear();
  });

  it("maps each of the five visible tabs to its indicator position", () => {
    const routes = VISIBLE_ROUTES.map((name) => ({ key: `${name}-key` }));
    expect(routes.map((route) => getActiveTabIndex(routes, route.key))).toEqual([0, 1, 2, 3, 4]);

    expect(
      VISIBLE_ROUTES.map((_, index) => getIndicatorMetrics(500, VISIBLE_ROUTES.length, index).translateX),
    ).toEqual([0, 100, 200, 300, 400]);
  });

  it("returns no active index and no visual position when the active route is unavailable", () => {
    const routes = VISIBLE_ROUTES.map((name) => ({ key: `${name}-key` }));

    expect(getActiveTabIndex(routes, "settings-key")).toBeNull();
    expect(getIndicatorMetrics(0, routes.length, 0)).toEqual({ cellWidth: 0, translateX: 0 });
    expect(getIndicatorMetrics(500, 0, 0)).toEqual({ cellWidth: 0, translateX: 0 });
    expect(getAvailableTabBarWidth(4)).toBe(0);
  });

  it("places the initial capsule under the focused tab and never intercepts presses", async () => {
    const screen = await render(<WalletTabBar {...createProps(3)} />);
    const root = screen.root!;
    const tabList = root.queryAll((node) => node.props.accessibilityRole === "tablist")[0];
    const indicatorBeforeLayout = root.queryAll((node) => node.props.pointerEvents === "none");
    const hostStyle = StyleSheet.flatten(root.props.style);
    const barStyle = StyleSheet.flatten(tabList.props.style);

    expect(indicatorBeforeLayout).toHaveLength(1);
    expect(hostStyle.backgroundColor).toBe("transparent");
    expect(hostStyle.padding).toBe(0);
    expect(hostStyle.elevation).toBe(0);
    expect(barStyle.backgroundColor).toBe("#FFFFFF");
    await fireEvent(tabList, "layout", { nativeEvent: { layout: { width: 508 } } });
    await screen.rerender(<WalletTabBar {...createProps(3)} />);

    const indicator = screen.root!.queryAll((node) => node.props.pointerEvents === "none")[0];
    const style = StyleSheet.flatten(indicator.props.style);
    expect(style.width).toBe(100);
    expect(style.transform).toEqual([{ translateX: 300 }]);
    expect(indicator.props.pointerEvents).toBe("none");
    expect(style.zIndex).toBe(0);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });

  it("uses timing only on Android when animations are allowed", () => {
    expect(shouldAnimateTabIndicator("android", false)).toBe(true);
    expect(shouldAnimateTabIndicator("android", true)).toBe(false);
    expect(shouldAnimateTabIndicator("web", false)).toBe(false);
    expect(shouldAnimateTabIndicator("ios", false)).toBe(false);
  });

  it("keeps the capsule width tied to the measured usable bar width", () => {
    expect(getAvailableTabBarWidth(508)).toBe(500);
    expect(getIndicatorMetrics(getAvailableTabBarWidth(508), 5, 4)).toEqual({
      cellWidth: 100,
      translateX: 400,
    });
  });
});
