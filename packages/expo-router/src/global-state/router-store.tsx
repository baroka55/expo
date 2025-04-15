'use client';

import {
  NavigationContainerRefWithCurrent,
  NavigationState,
  useNavigationContainerRef,
} from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { ComponentType, Fragment, useEffect } from 'react';
import { Platform } from 'react-native';

import { UrlObject, getRouteInfoFromState } from '../LocationProvider';
import { RouteNode } from '../Route';
import { getPathDataFromState, getPathFromState } from '../fork/getPathFromState';
import { ResultState } from '../fork/getStateFromPath';
import { cleanPath, routePatternToRegex } from '../fork/getStateFromPath-forks';
import { ExpoLinkingOptions, LinkingConfigOptions, getLinkingConfig } from '../getLinkingConfig';
import { parseRouteSegments } from '../getReactNavigationConfig';
import { getRoutes } from '../getRoutes';
import { RedirectConfig } from '../getRoutesCore';
import { convertRedirect } from '../getRoutesRedirects';
import { RequireContext } from '../types';
import { getQualifiedRouteComponent } from '../useScreens';
import { shouldLinkExternally } from '../utils/url';
import * as SplashScreen from '../views/Splash';

export type StoreState = NavigationState | ResultState;

type StoreRef = {
  navigationRef: NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>;
  routeNode: RouteNode | null;
  rootComponent: ComponentType<any>;
  state?: StoreState;
  linking?: ExpoLinkingOptions;
  config: any;
  redirects: (readonly [RegExp, RedirectConfig, boolean])[];
};

const storeRef = {
  current: {} as StoreRef,
};

const routeInfoCache = new WeakMap<StoreState, UrlObject>();

let splashScreenAnimationFrame: number | undefined;
let hasAttemptedToHideSplash = false;

export const store = {
  shouldShowTutorial() {
    return !storeRef.current.routeNode && process.env.NODE_ENV === 'development';
  },
  get state() {
    return storeRef.current.state;
  },
  get navigationRef() {
    return storeRef.current.navigationRef;
  },
  getRouteInfo(): UrlObject {
    const state = storeRef.current.state;

    if (!state) {
      return {
        unstable_globalHref: '',
        pathname: '',
        params: {},
        segments: [],
        isIndex: true,
      };
    }

    let routeInfo = routeInfoCache.get(state);
    if (!routeInfo) {
      routeInfo = getRouteInfoFromState(
        (state: Parameters<typeof getPathFromState>[0], asPath: boolean) => {
          return getPathDataFromState(state, {
            screens: {},
            ...storeRef.current.linking?.config,
            preserveDynamicRoutes: asPath,
            preserveGroups: asPath,
            shouldEncodeURISegment: false,
          });
        },
        state
      );

      routeInfoCache.set(state, routeInfo);
    }

    return routeInfo;
  },
  get redirects() {
    return storeRef.current.redirects || [];
  },
  get rootComponent() {
    return storeRef.current.rootComponent;
  },
  get linking() {
    return storeRef.current.linking;
  },
  setState(state: StoreState) {
    storeRef.current.state = state;
  },
  onReady() {
    if (!hasAttemptedToHideSplash) {
      hasAttemptedToHideSplash = true;
      // NOTE(EvanBacon): `navigationRef.isReady` is sometimes not true when state is called initially.
      splashScreenAnimationFrame = requestAnimationFrame(() => {
        SplashScreen._internal_maybeHideAsync?.();
      });
    }
  },
  assertIsReady() {
    if (!storeRef.current.navigationRef.isReady()) {
      throw new Error(
        'Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.'
      );
    }
  },
  applyRedirects<T extends string | null | undefined>(url: T): T {
    if (typeof url !== 'string') {
      return url;
    }

    const nextUrl = cleanPath(url);
    const redirect = store.redirects.find(([regex]) => regex.test(nextUrl));

    if (!redirect) {
      return url;
    }

    // If the redirect is external, open the URL
    if (redirect[2]) {
      let href = redirect[1].destination as T & string;
      if (href.startsWith('//') && Platform.OS !== 'web') {
        href = `https:${href}` as T & string;
      }

      Linking.openURL(href);
      return href;
    }

    return store.applyRedirects<T>(convertRedirect(url, redirect[1]) as T);
  },
};

export function useStore(
  context: RequireContext,
  linkingConfigOptions: LinkingConfigOptions,
  serverUrl?: string
) {
  const navigationRef = useNavigationContainerRef();
  const config = Constants.expoConfig?.extra?.router;

  let linking: ExpoLinkingOptions | undefined;
  let rootComponent: ComponentType<any> = Fragment;
  let initialState: StoreState | undefined;

  const routeNode = getRoutes(context, {
    ...config,
    ignoreEntryPoints: true,
    platform: Platform.OS,
  });

  if (routeNode) {
    // We have routes, so get the linking config and the root component
    linking = getLinkingConfig(routeNode, context, {
      metaOnly: linkingConfigOptions.metaOnly,
      serverUrl,
    });
    rootComponent = getQualifiedRouteComponent(routeNode);

    // By default React Navigation is async and does not render anything in the first pass as it waits for `getInitialURL`
    // This will cause static rendering to fail, which once performs a single pass.
    // If the initialURL is a string, we can prefetch the state and routeInfo, skipping React Navigation's async behavior.
    const initialURL = linking?.getInitialURL?.();
    if (typeof initialURL === 'string') {
      initialState = linking.getStateFromPath(initialURL, linking.config);
    }
  } else {
    // Only error in production, in development we will show the onboarding screen
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No routes found');
    }

    // In development, we will show the onboarding screen
    rootComponent = Fragment;
  }

  const redirects = [config?.redirects, config?.rewrites]
    .filter(Boolean)
    .flat()
    .map((route) => {
      return [
        routePatternToRegex(parseRouteSegments(route.source)),
        route,
        shouldLinkExternally(route.destination),
      ] as const;
    });

  storeRef.current = {
    navigationRef,
    routeNode,
    config,
    rootComponent,
    linking,
    redirects,
    state: initialState,
  };

  useEffect(() => {
    return () => {
      // listener();

      if (splashScreenAnimationFrame) {
        cancelAnimationFrame(splashScreenAnimationFrame);
        splashScreenAnimationFrame = undefined;
      }
    };
  });

  return store;
}
