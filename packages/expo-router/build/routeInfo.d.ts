import type { FocusedRouteState, ReactNavigationState } from './global-state/router-store';
export type UrlObject = {
    unstable_globalHref: string;
    pathname: string;
    readonly params: Record<string, string | string[]>;
    searchParams: URLSearchParams;
    segments: string[];
    pathnameWithParams: string;
};
export declare const defaultRouteInfo: UrlObject;
export declare function getRouteInfoFromFocusedState(focusedState: FocusedRouteState | ReactNavigationState): UrlObject;
//# sourceMappingURL=routeInfo.d.ts.map